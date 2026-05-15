-- ============================================================
-- ContAuditAI — analizar_tenant v4: conciliación por monto+fecha
-- Como lo hace un contador: cruza monto de factura vs depósito
-- ============================================================

-- Liberar enums para permitir tipos de alerta flexibles
ALTER TABLE contauditai.alertas_riesgo
  ALTER COLUMN tipo_alerta TYPE TEXT USING tipo_alerta::text,
  ALTER COLUMN severidad   TYPE TEXT USING severidad::text;

CREATE OR REPLACE FUNCTION contauditai.analizar_tenant()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai, public
AS $$
DECLARE
  v_tenant_id UUID;
  v_periodo   DATE;
  v_cfdi      RECORD;
  v_tx_id     UUID;
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

  -- ── 4. Conciliación monto + fecha (como lo hace un contador) ─
  -- Para cada factura de ingreso, busca un depósito del mismo monto
  -- dentro de la ventana: 7 días antes hasta 45 días después
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
      UPDATE contauditai.transacciones_bancarias
        SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_cfdi.total, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'ALTA', v_cfdi.total);
    END IF;
  END LOOP;

  -- ── 5. Facturas sin cobrar +30 días (Baja) ───────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'FACTURA_VENCIDA', 'BAJA',
         'Factura de $' || c.total::text || ' sin cobrar desde ' || c.fecha_emision::DATE::text || '.', c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision < NOW() - INTERVAL '30 days';

  -- ── 6. Depósitos sin factura (Media) ─────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion)
  SELECT v_tenant_id, 'INGRESO_NO_FACTURADO', 'MEDIA',
         'Depósito de $' || tb.monto::text || ' del ' || tb.fecha_operacion::DATE::text || ' sin factura.'
  FROM contauditai.transacciones_bancarias tb
  WHERE tb.tenant_id = v_tenant_id
    AND tb.tipo = 'Ingreso'
    AND tb.conciliado = FALSE;

  -- ── 7. Scoring ponderado ─────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE severidad = 'CRITICA'),
    COUNT(*) FILTER (WHERE severidad = 'MEDIA'),
    COUNT(*) FILTER (WHERE severidad = 'BAJA')
  INTO v_criticas, v_medias, v_bajas
  FROM contauditai.alertas_riesgo
  WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';

  v_score := GREATEST(0, 100 - (v_criticas * 15) - (v_medias * 5) - (v_bajas * 1));

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
