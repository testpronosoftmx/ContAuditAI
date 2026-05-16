-- ============================================================
-- ContAuditAI — analizar_tenant v12
-- Split paso 7 en dos sub-pasos con descripciones específicas:
--   7a. Near-exact (diff ≤ $5.00): posible retención no declarada
--   7b. Pago parcial (50%-99%): saldo pendiente explícito
-- Los registros BAJA siguen en conciliaciones para el link DB
-- CFDI↔banco, pero la UI tabla solo muestra ALTA.
-- ============================================================

CREATE OR REPLACE FUNCTION contauditai.analizar_tenant()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai, public
AS $$
DECLARE
  v_tenant_id  UUID;
  v_tenant_rfc VARCHAR(13);
  v_periodo    DATE;
  v_cfdi       RECORD;
  v_tx_id      UUID;
  v_tx_monto   NUMERIC;
  v_net        NUMERIC;
  v_diff       NUMERIC;
  v_criticas   INT;
  v_medias     INT;
  v_bajas      INT;
  v_score      NUMERIC;
BEGIN
  v_periodo := DATE_TRUNC('month', NOW())::DATE;

  -- ── 0. Tenant ────────────────────────────────────────────────
  SELECT tu.tenant_id, t.rfc_empresa
  INTO v_tenant_id, v_tenant_rfc
  FROM contauditai.tenant_users tu
  JOIN contauditai.tenants t ON t.id = tu.tenant_id
  WHERE tu.user_id = auth.uid() AND tu.activo = TRUE
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tenant activo para el usuario';
  END IF;

  -- ── 1. Reset: solo Pendientes, nunca toca Resuelto/Ignorado ──
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
  SELECT
    v_tenant_id, 'EFOS_DETECTADO', 'CRITICA',
    '[EFOS] ' || LEFT(c.uuid::text, 8) ||
    ' — Emisor: ' || c.rfc_emisor ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — ' || TO_CHAR(c.fecha_emision, 'DD/MM/YYYY'),
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_emisor
  WHERE c.tenant_id = v_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'EFOS_DETECTADO'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 3. CANCELACION_RETROACTIVA (Crítica) ─────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'CANCELACION_RETROACTIVA', 'CRITICA',
    '[Cancelación] ' || LEFT(c.uuid::text, 8) ||
    ' — ' || c.rfc_emisor ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — Cancelado el ' || TO_CHAR(c.fecha_validacion_sat, 'DD/MM/YYYY') ||
    ' (' || (c.fecha_validacion_sat::date - c.fecha_emision::date) || ' días después de emitirse)',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.estado_sat = 'Cancelado'
    AND c.fecha_validacion_sat IS NOT NULL
    AND c.fecha_validacion_sat > c.fecha_emision + INTERVAL '1 day'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'CANCELACION_RETROACTIVA'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 4. PPD sin CRP ───────────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'PPD_SIN_CRP', 'MEDIA',
    '[PPD sin CRP] ' || LEFT(c.uuid::text, 8) ||
    ' — ' || CASE
      WHEN c.rfc_emisor = v_tenant_rfc THEN 'Cliente: ' || c.rfc_receptor
      ELSE 'Proveedor: ' || c.rfc_emisor
    END ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — Emitida: ' || TO_CHAR(c.fecha_emision, 'DD/MM/YYYY') ||
    ' (' || (CURRENT_DATE - c.fecha_emision::date) || ' días sin CRP)',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.metodo_pago = 'PPD'
    AND (c.rfc_emisor = v_tenant_rfc OR c.rfc_receptor = v_tenant_rfc)
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.cfdi_pagos p
      WHERE p.uuid_relacionado = c.uuid AND p.tenant_id = v_tenant_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'PPD_SIN_CRP'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 5. Match Perfecto: UUID en concepto o referencia bancaria ─
  FOR v_cfdi IN
    SELECT uuid, total, isr_retenido, concepto, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I'
    ORDER BY fecha_emision ASC
  LOOP
    v_net := v_cfdi.total - v_cfdi.isr_retenido;
    SELECT id INTO v_tx_id
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
      AND ABS(monto - v_net) < 1.00
      AND (
        concepto_bancario ILIKE '%' || REPLACE(v_cfdi.uuid::text, '-', '') || '%'
        OR concepto_bancario ILIKE '%' || v_cfdi.uuid::text || '%'
        OR clave_rastreo    ILIKE '%' || REPLACE(v_cfdi.uuid::text, '-', '') || '%'
        OR clave_rastreo    ILIKE '%' || v_cfdi.uuid::text || '%'
      )
    LIMIT 1;
    IF v_tx_id IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_net, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'ALTA', v_net);
    END IF;
  END LOOP;

  -- ── 6. Match exacto: monto neto + fecha ──────────────────────
  FOR v_cfdi IN
    SELECT uuid, total, isr_retenido, concepto, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I'
      AND rfc_emisor = v_tenant_rfc AND estado_conciliacion = 'Sin_Conciliar'
    ORDER BY fecha_emision ASC
  LOOP
    v_net := v_cfdi.total - v_cfdi.isr_retenido;
    SELECT id INTO v_tx_id
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
      AND monto = v_net
      AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                              AND v_cfdi.fecha_emision + INTERVAL '45 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (fecha_operacion - v_cfdi.fecha_emision)))
    LIMIT 1;
    IF v_tx_id IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_net, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'ALTA', v_net);
    END IF;
  END LOOP;

  -- ── 7a. Near-exact: diferencia ≤ $5.00 (retención probable) ──
  -- El depósito está $0.01–$5.00 por debajo del monto neto.
  -- Sin UUID en referencia bancaria — no se puede confirmar al 100%.
  -- La alerta indica posible retención ISR/IVA no declarada en XML.
  FOR v_cfdi IN
    SELECT uuid, total, isr_retenido, concepto, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I'
      AND rfc_emisor = v_tenant_rfc AND estado_conciliacion = 'Sin_Conciliar'
    ORDER BY fecha_emision ASC
  LOOP
    v_net := v_cfdi.total - v_cfdi.isr_retenido;
    SELECT id, monto INTO v_tx_id, v_tx_monto
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
      AND monto BETWEEN v_net - 5.00 AND v_net - 0.01
      AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                              AND v_cfdi.fecha_emision + INTERVAL '45 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (fecha_operacion - v_cfdi.fecha_emision)))
    LIMIT 1;
    IF v_tx_id IS NOT NULL THEN
      v_diff := v_net - v_tx_monto;
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_tx_monto, estado_conciliacion = 'Parcial'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'BAJA', v_tx_monto);
      IF NOT EXISTS (
        SELECT 1 FROM contauditai.alertas_riesgo ar
        WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'DISCREPANCIA_BANCARIA'
          AND ar.uuid_referencia = v_cfdi.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
      ) THEN
        INSERT INTO contauditai.alertas_riesgo
          (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
        VALUES (
          v_tenant_id, 'DISCREPANCIA_BANCARIA', 'MEDIA',
          '[Retención posible] ' || LEFT(v_cfdi.uuid::text, 8) ||
          COALESCE(' — "' || v_cfdi.concepto || '"', '') ||
          ' — Diferencia de $' || TO_CHAR(v_diff, 'FM999,990.00') ||
          ' ($' || TO_CHAR(v_tx_monto, 'FM999,999,990.00') ||
          ' recibido vs $' || TO_CHAR(v_net, 'FM999,999,990.00') || ' esperado)' ||
          ' — ¿Retención ISR/IVA no declarada en XML? Solicitar CRP.',
          v_cfdi.uuid
        );
      END IF;
    END IF;
  END LOOP;

  -- ── 7b. Pago parcial: 50%-99% del monto neto ─────────────────
  -- El depósito cubre entre el 50% y el 99% del monto esperado.
  -- La alerta detalla el saldo pendiente y exige CRP por el abono.
  FOR v_cfdi IN
    SELECT uuid, total, isr_retenido, concepto, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I'
      AND rfc_emisor = v_tenant_rfc AND estado_conciliacion = 'Sin_Conciliar'
    ORDER BY fecha_emision ASC
  LOOP
    v_net := v_cfdi.total - v_cfdi.isr_retenido;
    SELECT id, monto INTO v_tx_id, v_tx_monto
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
      AND monto BETWEEN v_net * 0.50 AND v_net - 5.01
      AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                              AND v_cfdi.fecha_emision + INTERVAL '45 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (fecha_operacion - v_cfdi.fecha_emision)))
    LIMIT 1;
    IF v_tx_id IS NOT NULL THEN
      v_diff := v_net - v_tx_monto;
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_tx_monto, estado_conciliacion = 'Parcial'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'BAJA', v_tx_monto);
      IF NOT EXISTS (
        SELECT 1 FROM contauditai.alertas_riesgo ar
        WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'DISCREPANCIA_BANCARIA'
          AND ar.uuid_referencia = v_cfdi.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
      ) THEN
        INSERT INTO contauditai.alertas_riesgo
          (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
        VALUES (
          v_tenant_id, 'DISCREPANCIA_BANCARIA', 'MEDIA',
          '[Pago parcial] ' || LEFT(v_cfdi.uuid::text, 8) ||
          COALESCE(' — "' || v_cfdi.concepto || '"', '') ||
          ' — Cobrado $' || TO_CHAR(v_tx_monto, 'FM999,999,990.00') ||
          ' (' || ROUND((v_tx_monto / v_net) * 100, 1)::text || '%) de $' ||
          TO_CHAR(v_net, 'FM999,999,990.00') ||
          ' — Saldo pendiente: $' || TO_CHAR(v_diff, 'FM999,999,990.00') ||
          ' — Emitir CRP por el abono y gestionar cobro del saldo.',
          v_cfdi.uuid
        );
      END IF;
    END IF;
  END LOOP;

  -- ── 8. VENTANA_72H ───────────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'VENTANA_72H', 'MEDIA',
    '[CFDI tardío] ' || LEFT(c.uuid::text, 8) ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    ' — CFDI expedido ' ||
    ROUND(EXTRACT(EPOCH FROM (c.fecha_emision - tb.fecha_operacion)) / 3600)::text ||
    'h después del depósito (límite SAT: 72h)',
    c.uuid
  FROM contauditai.conciliaciones con
  JOIN contauditai.cfdi_comprobantes c ON c.uuid = con.cfdi_uuid AND c.tenant_id = v_tenant_id
  JOIN contauditai.transacciones_bancarias tb ON tb.id = con.transaccion_id
  WHERE con.tenant_id = v_tenant_id
    AND c.fecha_emision > tb.fecha_operacion + INTERVAL '72 hours'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'VENTANA_72H'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 9. CRUCE DE MES ──────────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'CONCILIACION_CRUCE_MES', 'BAJA',
    '[Cruce de mes] ' || LEFT(c.uuid::text, 8) ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    ' — Facturado ' || TO_CHAR(c.fecha_emision, 'Mon YYYY') ||
    ', cobrado ' || TO_CHAR(tb.fecha_operacion, 'Mon YYYY'),
    c.uuid
  FROM contauditai.conciliaciones con
  JOIN contauditai.cfdi_comprobantes c ON c.uuid = con.cfdi_uuid AND c.tenant_id = v_tenant_id
  JOIN contauditai.transacciones_bancarias tb ON tb.id = con.transaccion_id
  WHERE con.tenant_id = v_tenant_id
    AND DATE_TRUNC('month', c.fecha_emision) <> DATE_TRUNC('month', tb.fecha_operacion)
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'CONCILIACION_CRUCE_MES'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 10. MATERIALIDAD_FALTANTE ─────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'MATERIALIDAD_FALTANTE', 'MEDIA',
    '[Materialidad] ' || LEFT(c.uuid::text, 8) ||
    ' — ' || c.rfc_emisor ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — Sin contratos ni entregables (Art. 49-Bis)',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I' AND c.total >= 20000
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.evidencia_materialidad e
      WHERE e.uuid_cfdi = c.uuid AND e.tenant_id = v_tenant_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'MATERIALIDAD_FALTANTE'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 11. HUERFANO_XML: sin cobro ≤ 30 días ────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'HUERFANO_XML', 'BAJA',
    '[Sin pago] ' || LEFT(c.uuid::text, 8) ||
    ' — ' || c.rfc_emisor ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — Emitida hace ' || (CURRENT_DATE - c.fecha_emision::date) || ' días',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I' AND c.rfc_emisor = v_tenant_rfc
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision >= NOW() - INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'HUERFANO_XML'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 12. FACTURA_VENCIDA: sin cobro > 30 días ─────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'FACTURA_VENCIDA', 'BAJA',
    '[Vencida] ' || LEFT(c.uuid::text, 8) ||
    ' — ' || c.rfc_emisor ||
    ' — $' || TO_CHAR(c.total, 'FM999,999,990.00') ||
    COALESCE(' — "' || c.concepto || '"', '') ||
    ' — Sin cobrar desde ' || TO_CHAR(c.fecha_emision, 'DD/MM/YYYY') ||
    ' (' || (CURRENT_DATE - c.fecha_emision::date) || ' días)',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I' AND c.rfc_emisor = v_tenant_rfc
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision < NOW() - INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.alertas_riesgo ar
      WHERE ar.tenant_id = v_tenant_id AND ar.tipo_alerta = 'FACTURA_VENCIDA'
        AND ar.uuid_referencia = c.uuid AND ar.estado IN ('Resuelto', 'Ignorado')
    );

  -- ── 13. INGRESO_NO_FACTURADO ──────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion)
  SELECT
    v_tenant_id, 'INGRESO_NO_FACTURADO', 'MEDIA',
    '[Sin factura] $' || TO_CHAR(tb.monto, 'FM999,999,990.00') ||
    ' — ' || TO_CHAR(tb.fecha_operacion, 'DD/MM/YYYY') ||
    CASE WHEN tb.rfc_contraparte IS NOT NULL THEN ' — RFC: ' || tb.rfc_contraparte ELSE '' END ||
    CASE WHEN tb.clave_rastreo   IS NOT NULL THEN ' — Clave: ' || tb.clave_rastreo  ELSE '' END
  FROM contauditai.transacciones_bancarias tb
  WHERE tb.tenant_id = v_tenant_id AND tb.tipo = 'Ingreso' AND tb.conciliado = FALSE;

  -- ── 14. Scoring ───────────────────────────────────────────────
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
    'score', v_score, 'criticas', v_criticas, 'medias', v_medias, 'bajas', v_bajas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.analizar_tenant() TO authenticated;
