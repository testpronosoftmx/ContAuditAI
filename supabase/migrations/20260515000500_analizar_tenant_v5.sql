-- ============================================================
-- ContAuditAI — analizar_tenant v5: motor completo
-- Agrega: DISCREPANCIA_BANCARIA, MATERIALIDAD_FALTANTE,
--         VENTANA_72H, CONCILIACION_CRUCE_MES, HUERFANO_XML
-- ============================================================

CREATE OR REPLACE FUNCTION contauditai.analizar_tenant()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai, public
AS $$
DECLARE
  v_tenant_id UUID;
  v_periodo   DATE;
  v_cfdi      RECORD;
  v_tx_id     UUID;
  v_tx_monto  NUMERIC;
  v_criticas  INT;
  v_medias    INT;
  v_bajas     INT;
  v_score     NUMERIC;
BEGIN
  v_periodo := DATE_TRUNC('month', NOW())::DATE;

  -- ── 0. Tenant ────────────────────────────────────────────────
  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tenant activo para el usuario';
  END IF;

  -- ── 1. Reset ─────────────────────────────────────────────────
  DELETE FROM contauditai.alertas_riesgo
    WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';
  DELETE FROM contauditai.conciliaciones
    WHERE tenant_id = v_tenant_id;
  UPDATE contauditai.cfdi_comprobantes
    SET monto_conciliado = 0, estado_conciliacion = 'Sin_Conciliar'
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I';
  UPDATE contauditai.transacciones_bancarias
    SET conciliado = FALSE
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso';

  -- ── 2. EFOS (Crítica) ────────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'EFOS_DETECTADO', 'CRITICA',
         'RFC ' || c.rfc_emisor || ' aparece en lista negra del SAT (EFOS).', c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_emisor
  WHERE c.tenant_id = v_tenant_id;

  -- ── 3. PPD sin CRP (Media) ───────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'PPD_SIN_CRP', 'MEDIA',
         'Factura PPD sin Complemento de Pago recibido.', c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.metodo_pago = 'PPD'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.cfdi_pagos p
      WHERE p.uuid_relacionado = c.uuid AND p.tenant_id = v_tenant_id
    );

  -- ── 4. Match exacto: monto + fecha (como contador en Excel) ──
  FOR v_cfdi IN
    SELECT uuid, total, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I'
    ORDER BY fecha_emision ASC
  LOOP
    SELECT id INTO v_tx_id
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id
      AND tipo = 'Ingreso'
      AND conciliado = FALSE
      AND monto = v_cfdi.total
      AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                              AND v_cfdi.fecha_emision + INTERVAL '45 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (fecha_operacion - v_cfdi.fecha_emision)))
    LIMIT 1;

    IF v_tx_id IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_cfdi.total, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'ALTA', v_cfdi.total);
    END IF;
  END LOOP;

  -- ── 5. Match parcial: pago entre 10% y 95% del total ─────────
  -- Para CFDIs que no encontraron match exacto
  FOR v_cfdi IN
    SELECT uuid, total, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id
      AND tipo_comprobante = 'I'
      AND estado_conciliacion = 'Sin_Conciliar'
    ORDER BY fecha_emision ASC
  LOOP
    SELECT id, monto INTO v_tx_id, v_tx_monto
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id
      AND tipo = 'Ingreso'
      AND conciliado = FALSE
      AND monto BETWEEN v_cfdi.total * 0.10 AND v_cfdi.total * 0.95
      AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                              AND v_cfdi.fecha_emision + INTERVAL '45 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (fecha_operacion - v_cfdi.fecha_emision)))
    LIMIT 1;

    IF v_tx_id IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_tx_monto, estado_conciliacion = 'Parcial'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'BAJA', v_tx_monto);
      INSERT INTO contauditai.alertas_riesgo
        (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
        VALUES (v_tenant_id, 'DISCREPANCIA_BANCARIA', 'MEDIA',
                'Pago parcial: se recibió $' || v_tx_monto::text ||
                ' de $' || v_cfdi.total::text || ' facturado.',
                v_cfdi.uuid);
    END IF;
  END LOOP;

  -- ── 6. VENTANA_72H: depósito llegó 72h+ antes del CFDI ───────
  -- Riesgo: cliente pagó y el CFDI se expidió tarde (incumplimiento SAT)
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'VENTANA_72H', 'MEDIA',
         'CFDI expedido ' ||
         ROUND(EXTRACT(EPOCH FROM (c.fecha_emision - tb.fecha_operacion)) / 3600)::text ||
         'h después del depósito (límite SAT: 72h).', c.uuid
  FROM contauditai.conciliaciones con
  JOIN contauditai.cfdi_comprobantes c
    ON c.uuid = con.cfdi_uuid AND c.tenant_id = v_tenant_id
  JOIN contauditai.transacciones_bancarias tb
    ON tb.id = con.transaccion_id
  WHERE con.tenant_id = v_tenant_id
    AND c.fecha_emision > tb.fecha_operacion + INTERVAL '72 hours';

  -- ── 7. CRUCE DE MES: factura y cobro en meses distintos ──────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'CONCILIACION_CRUCE_MES', 'BAJA',
         'Factura de ' || TO_CHAR(c.fecha_emision, 'Mon YYYY') ||
         ' cobrada en ' || TO_CHAR(tb.fecha_operacion, 'Mon YYYY') || '.', c.uuid
  FROM contauditai.conciliaciones con
  JOIN contauditai.cfdi_comprobantes c
    ON c.uuid = con.cfdi_uuid AND c.tenant_id = v_tenant_id
  JOIN contauditai.transacciones_bancarias tb
    ON tb.id = con.transaccion_id
  WHERE con.tenant_id = v_tenant_id
    AND DATE_TRUNC('month', c.fecha_emision) <> DATE_TRUNC('month', tb.fecha_operacion);

  -- ── 8. MATERIALIDAD_FALTANTE: facturas grandes sin evidencia ─
  -- Facturas de ingreso >= $50,000 sin documentos de soporte
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'MATERIALIDAD_FALTANTE', 'MEDIA',
         'Factura de $' || c.total::text || ' sin evidencia de materialidad (contratos, entregables).', c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.total >= 20000
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.evidencia_materialidad e
      WHERE e.uuid_cfdi = c.uuid AND e.tenant_id = v_tenant_id
    );

  -- ── 9. HUERFANO_XML: CFDI reciente sin cobro (< 30 días) ─────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'HUERFANO_XML', 'BAJA',
         'Factura de $' || c.total::text || ' del ' ||
         c.fecha_emision::DATE::text || ' sin pago detectado.', c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision >= NOW() - INTERVAL '30 days';

  -- ── 10. FACTURA_VENCIDA: sin cobrar más de 30 días ───────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'FACTURA_VENCIDA', 'BAJA',
         'Factura de $' || c.total::text || ' sin cobrar desde ' ||
         c.fecha_emision::DATE::text || '.', c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision < NOW() - INTERVAL '30 days';

  -- ── 11. INGRESO_NO_FACTURADO: depósito sin factura ───────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion)
  SELECT v_tenant_id, 'INGRESO_NO_FACTURADO', 'MEDIA',
         'Depósito de $' || tb.monto::text || ' del ' ||
         tb.fecha_operacion::DATE::text || ' sin factura.'
  FROM contauditai.transacciones_bancarias tb
  WHERE tb.tenant_id = v_tenant_id
    AND tb.tipo = 'Ingreso'
    AND tb.conciliado = FALSE;

  -- ── 12. Scoring ponderado ────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE severidad = 'CRITICA'),
    COUNT(*) FILTER (WHERE severidad = 'MEDIA'),
    COUNT(*) FILTER (WHERE severidad = 'BAJA')
  INTO v_criticas, v_medias, v_bajas
  FROM contauditai.alertas_riesgo
  WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';

  v_score := GREATEST(0, 100 - (v_criticas * 10) - (v_medias * 2) - (v_bajas * 0.5));

  INSERT INTO contauditai.risk_scores (tenant_id, periodo, score, factores)
  VALUES (v_tenant_id, v_periodo, v_score,
          jsonb_build_object('criticas', v_criticas, 'medias', v_medias, 'bajas', v_bajas))
  ON CONFLICT (tenant_id, periodo)
  DO UPDATE SET score = EXCLUDED.score, factores = EXCLUDED.factores;

  RETURN jsonb_build_object(
    'score',    v_score,
    'criticas', v_criticas,
    'medias',   v_medias,
    'bajas',    v_bajas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.analizar_tenant() TO authenticated;
