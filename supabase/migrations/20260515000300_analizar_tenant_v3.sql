-- ============================================================
-- ContAuditAI — analizar_tenant v3: corrección de columnas
-- Fixes: cfdi_comprobantes.id→uuid, folio, conciliaciones cols
-- ============================================================

CREATE OR REPLACE FUNCTION contauditai.analizar_tenant()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = contauditai, public
AS $$
DECLARE
  v_tenant_id  UUID;
  v_periodo    DATE;
  v_cfdi       RECORD;
  v_tx         RECORD;
  v_tx_id      UUID;
  v_tx_monto   NUMERIC;
  v_matched    BOOLEAN;
  -- Match Global
  v_uuid1 UUID;  v_total1 NUMERIC;  v_fecha1 TIMESTAMPTZ;
  v_uuid2 UUID;  v_total2 NUMERIC;  v_fecha2 TIMESTAMPTZ;
  -- Contadores
  v_criticas   INT;
  v_medias     INT;
  v_bajas      INT;
  v_score      NUMERIC;
BEGIN
  v_periodo := DATE_TRUNC('month', NOW())::DATE;

  -- ── 0. Tenant del usuario ─────────────────────────────────────
  SELECT tu.tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users tu
  WHERE tu.user_id = auth.uid() AND tu.activo = TRUE
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tenant activo para el usuario';
  END IF;

  -- ── 1. Reset ──────────────────────────────────────────────────
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

  -- ── 2. EFOS (Crítica) ─────────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'EFOS_DETECTADO', 'CRITICA',
         'RFC emisor ' || c.rfc_emisor || ' en lista EFOS.', c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_emisor
  WHERE c.tenant_id = v_tenant_id;

  -- ── 3. PPD sin CRP (Media) ────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'PPD_SIN_CRP', 'MEDIA',
         'Factura PPD sin Complemento de Pago.', c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.metodo_pago = 'PPD'
    AND c.tipo_comprobante = 'I'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.cfdi_pagos p
      WHERE p.uuid_relacionado = c.uuid AND p.tenant_id = v_tenant_id
    );

  -- ── 4. Análisis Individual ────────────────────────────────────
  -- cfdi_comprobantes usa PK compuesta (uuid, fecha_emision), sin columna id ni folio
  FOR v_cfdi IN
    SELECT uuid, total, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id = v_tenant_id AND tipo_comprobante = 'I'
    ORDER BY fecha_emision DESC
  LOOP
    v_matched := FALSE;

    -- P1: Match Perfecto (UUID en concepto/clave_rastreo)
    SELECT id INTO v_tx_id
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
      AND (concepto_bancario ILIKE '%' || REPLACE(v_cfdi.uuid::text, '-', '') || '%'
           OR clave_rastreo ILIKE '%' || REPLACE(v_cfdi.uuid::text, '-', '') || '%')
      AND ABS(monto - v_cfdi.total) < 1.00
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
      v_matched := TRUE;
    END IF;

    -- P2: Monto exacto + ventana de fecha
    IF NOT v_matched THEN
      SELECT id INTO v_tx_id
      FROM contauditai.transacciones_bancarias
      WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
        AND monto = v_cfdi.total
        AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                                AND v_cfdi.fecha_emision + INTERVAL '45 days'
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        UPDATE contauditai.transacciones_bancarias
          SET conciliado = TRUE WHERE id = v_tx_id;
        UPDATE contauditai.cfdi_comprobantes
          SET monto_conciliado = v_cfdi.total, estado_conciliacion = 'Conciliado'
          WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
        INSERT INTO contauditai.conciliaciones
          (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
          VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'MEDIA', v_cfdi.total);
        v_matched := TRUE;
      END IF;
    END IF;

    -- P3: Pago parcial (10%–95% del total)
    IF NOT v_matched THEN
      SELECT id, monto INTO v_tx_id, v_tx_monto
      FROM contauditai.transacciones_bancarias
      WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
        AND monto > v_cfdi.total * 0.10
        AND monto < v_cfdi.total * 0.95
        AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                                AND v_cfdi.fecha_emision + INTERVAL '45 days'
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        UPDATE contauditai.transacciones_bancarias
          SET conciliado = TRUE WHERE id = v_tx_id;
        UPDATE contauditai.cfdi_comprobantes
          SET monto_conciliado = v_tx_monto, estado_conciliacion = 'Parcial'
          WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
        INSERT INTO contauditai.conciliaciones
          (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
          VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, 'BAJA', v_tx_monto);
        INSERT INTO contauditai.alertas_riesgo
          (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
          VALUES (v_tenant_id, 'DISCREPANCIA_BANCARIA', 'MEDIA',
                  'Pago parcial: $' || v_tx_monto::text || ' de $' || v_cfdi.total::text,
                  v_cfdi.uuid);
        v_matched := TRUE;
      END IF;
    END IF;
  END LOOP;

  -- ── 5. Match Global (2 CFDIs sumados = 1 depósito) ───────────
  FOR v_tx IN
    SELECT id, monto, fecha_operacion
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso' AND conciliado = FALSE
  LOOP
    SELECT c1.uuid, c1.total, c1.fecha_emision,
           c2.uuid, c2.total, c2.fecha_emision
    INTO   v_uuid1, v_total1, v_fecha1,
           v_uuid2, v_total2, v_fecha2
    FROM contauditai.cfdi_comprobantes c1
    JOIN contauditai.cfdi_comprobantes c2
      ON c2.tenant_id = v_tenant_id AND c2.uuid > c1.uuid
    WHERE c1.tenant_id = v_tenant_id
      AND c1.estado_conciliacion = 'Sin_Conciliar'
      AND c2.estado_conciliacion = 'Sin_Conciliar'
      AND ABS((c1.total + c2.total) - v_tx.monto) < 1.00
      AND v_tx.fecha_operacion BETWEEN c1.fecha_emision - INTERVAL '7 days'
                                   AND c1.fecha_emision + INTERVAL '45 days'
    LIMIT 1;

    IF v_uuid1 IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias
        SET conciliado = TRUE WHERE id = v_tx.id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = total, estado_conciliacion = 'Conciliado'
        WHERE uuid IN (v_uuid1, v_uuid2) AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, confianza, monto_aplicado)
        VALUES
        (v_tenant_id, v_uuid1, v_fecha1, v_tx.id, 'MEDIA', v_total1),
        (v_tenant_id, v_uuid2, v_fecha2, v_tx.id, 'MEDIA', v_total2);
    END IF;
  END LOOP;

  -- ── 6. Huérfanos bancarios → INGRESO_NO_FACTURADO ────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion)
  SELECT v_tenant_id, 'INGRESO_NO_FACTURADO', 'MEDIA',
         'Depósito de $' || tb.monto::text || ' sin factura.'
  FROM contauditai.transacciones_bancarias tb
  WHERE tb.tenant_id = v_tenant_id
    AND tb.tipo = 'Ingreso'
    AND tb.conciliado = FALSE;

  -- ── 7. Facturas vencidas sin cobrar ──────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT v_tenant_id, 'FACTURA_VENCIDA', 'BAJA',
         'Vencida: CFDI ' || c.uuid::text || ' del ' || c.fecha_emision::DATE::text,
         c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id = v_tenant_id
    AND c.tipo_comprobante = 'I'
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision < NOW() - INTERVAL '30 days';

  -- ── 8. Scoring ────────────────────────────────────────────────
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
    'score', v_score,
    'criticas', v_criticas,
    'medias', v_medias,
    'bajas', v_bajas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.analizar_tenant() TO authenticated;
