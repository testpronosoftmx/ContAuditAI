-- ============================================================
-- ContAuditAI — analizar_tenant v2: motor completo
-- Escenarios: Match Perfecto, Centavos, Global, Parcial,
--             PPD/CRP, EFOS, Cancelación, Huérfanos, Cruce Mes
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
  v_diff       NUMERIC;
  -- Match Global
  v_uuid1      UUID;   v_total1 NUMERIC;  v_fecha1 TIMESTAMPTZ;
  v_uuid2      UUID;   v_total2 NUMERIC;  v_fecha2 TIMESTAMPTZ;
  -- Contadores
  v_criticas   INT;
  v_medias     INT;
  v_bajas      INT;
  v_score      NUMERIC;
BEGIN
  v_periodo := DATE_TRUNC('month', NOW())::DATE;

  -- ── 0. Tenant del usuario ─────────────────────────────────────
  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tenant activo para el usuario';
  END IF;

  -- ── 1. Reset: análisis fresco ─────────────────────────────────
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

  -- ── 2. EFOS / EDOS ───────────────────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'EFOS_DETECTADO', 'CRITICA',
    'RFC emisor ' || c.rfc_emisor ||
      ' (' || COALESCE(e.nombre_contribuyente, 'Sin nombre') || ')' ||
      ' está en lista ' || e.tipo::text || ' del SAT. Gasto NO deducible.',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_emisor
  WHERE c.tenant_id = v_tenant_id;

  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'EFOS_DETECTADO', 'CRITICA',
    'RFC receptor ' || c.rfc_receptor ||
      ' (' || COALESCE(e.nombre_contribuyente, 'Sin nombre') || ')' ||
      ' está en lista ' || e.tipo::text || ' del SAT.',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_receptor
  WHERE c.tenant_id = v_tenant_id;

  -- ── 3. Cancelación indebida (factura pagada luego cancelada) ──
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'CANCELACION_RETROACTIVA', 'CRITICA',
    'CFDI por $' || c.total::text ||
      ' MXN (emitido ' || c.fecha_emision::DATE::text || ')' ||
      ' fue cancelado después de su emisión. Riesgo de deducción improcedente.',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id  = v_tenant_id
    AND c.estado_sat = 'Cancelado'
    AND c.fecha_validacion_sat IS NOT NULL
    AND c.fecha_validacion_sat > c.fecha_emision + INTERVAL '1 day';

  -- ── 4. PPD sin Complemento de Pago ───────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia, fecha_limite_accion)
  SELECT
    v_tenant_id, 'PPD_SIN_CRP', 'MEDIA',
    'Factura PPD por $' || c.total::text ||
      ' MXN del ' || c.fecha_emision::DATE::text ||
      ' tiene depósito bancario pero no tiene Complemento de Pago (CRP). Exigir al receptor.',
    c.uuid,
    c.fecha_emision + INTERVAL '72 hours'
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id        = v_tenant_id
    AND c.metodo_pago      = 'PPD'
    AND c.tipo_comprobante = 'I'
    AND c.estado_sat       = 'Vigente'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.cfdi_pagos p
      WHERE p.uuid_relacionado = c.uuid AND p.tenant_id = v_tenant_id
    );

  -- ── 5. Conciliación individual CFDI → Banco ───────────────────
  FOR v_cfdi IN
    SELECT uuid, total, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id        = v_tenant_id
      AND tipo_comprobante = 'I'
      AND estado_sat       = 'Vigente'
    ORDER BY fecha_emision DESC
  LOOP
    v_matched := FALSE;

    -- P1 ─ UUID del CFDI en concepto o clave de rastreo (Match Perfecto)
    SELECT id INTO v_tx_id
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id  = v_tenant_id
      AND tipo       = 'Ingreso'
      AND conciliado = FALSE
      AND (
        concepto_bancario ILIKE '%' || REPLACE(v_cfdi.uuid::text, '-', '') || '%'
        OR clave_rastreo  ILIKE '%' || REPLACE(v_cfdi.uuid::text, '-', '') || '%'
        OR concepto_bancario ILIKE '%' || v_cfdi.uuid::text || '%'
      )
      AND ABS(monto - v_cfdi.total) < 1.00
    LIMIT 1;

    IF v_tx_id IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_cfdi.total, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, monto_aplicado, confianza)
        VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, v_cfdi.total, 'ALTA');
      v_matched := TRUE;
    END IF;

    -- P2 ─ Monto exacto + ventana de fechas (incluye Cruce de Mes)
    IF NOT v_matched THEN
      SELECT id INTO v_tx_id
      FROM contauditai.transacciones_bancarias
      WHERE tenant_id  = v_tenant_id
        AND tipo       = 'Ingreso'
        AND conciliado = FALSE
        AND monto      = v_cfdi.total
        AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                                AND v_cfdi.fecha_emision + INTERVAL '45 days'
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
        UPDATE contauditai.cfdi_comprobantes
          SET monto_conciliado = v_cfdi.total, estado_conciliacion = 'Conciliado'
          WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
        INSERT INTO contauditai.conciliaciones
          (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, monto_aplicado, confianza)
          VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, v_cfdi.total, 'MEDIA');
        v_matched := TRUE;
      END IF;
    END IF;

    -- P2.5 ─ Tolerancia ≤1% (Diferencia de Centavos)
    IF NOT v_matched THEN
      SELECT id, monto INTO v_tx_id, v_tx_monto
      FROM contauditai.transacciones_bancarias
      WHERE tenant_id  = v_tenant_id
        AND tipo       = 'Ingreso'
        AND conciliado = FALSE
        AND v_cfdi.total > 0
        AND ABS(monto - v_cfdi.total) / v_cfdi.total <= 0.01
        AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '15 days'
                                AND v_cfdi.fecha_emision + INTERVAL '45 days'
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        v_diff := ABS(v_tx_monto - v_cfdi.total);
        UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
        UPDATE contauditai.cfdi_comprobantes
          SET monto_conciliado    = v_tx_monto,
              estado_conciliacion = CASE WHEN v_diff < 1.00 THEN 'Conciliado' ELSE 'Con_Diferencia' END
          WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
        INSERT INTO contauditai.conciliaciones
          (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, monto_aplicado, confianza)
          VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, v_tx_monto, 'BAJA');
        v_matched := TRUE;

        -- Alerta solo si diferencia ≥ $1 (centavos < $1 se cierran automático)
        IF v_diff >= 1.00 THEN
          INSERT INTO contauditai.alertas_riesgo
            (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
          VALUES (
            v_tenant_id, 'DISCREPANCIA_BANCARIA', 'BAJA',
            'Diferencia de $' || ROUND(v_diff, 2)::text ||
              ' MXN entre CFDI ($' || v_cfdi.total::text ||
              ') y depósito ($' || v_tx_monto::text || '). ¿Conciliar con diferencia?',
            v_cfdi.uuid
          );
        END IF;
      END IF;
    END IF;

    -- P3 ─ Pago Parcial (10%-95% del monto, misma ventana de fechas)
    IF NOT v_matched THEN
      SELECT id, monto INTO v_tx_id, v_tx_monto
      FROM contauditai.transacciones_bancarias
      WHERE tenant_id  = v_tenant_id
        AND tipo       = 'Ingreso'
        AND conciliado = FALSE
        AND monto      > v_cfdi.total * 0.10
        AND monto      < v_cfdi.total * 0.95
        AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                                AND v_cfdi.fecha_emision + INTERVAL '45 days'
      ORDER BY ABS(monto - v_cfdi.total)
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx_id;
        UPDATE contauditai.cfdi_comprobantes
          SET monto_conciliado = v_tx_monto, estado_conciliacion = 'Parcial'
          WHERE uuid = v_cfdi.uuid AND tenant_id = v_tenant_id;
        INSERT INTO contauditai.conciliaciones
          (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, monto_aplicado, confianza)
          VALUES (v_tenant_id, v_cfdi.uuid, v_cfdi.fecha_emision, v_tx_id, v_tx_monto, 'MEDIA');
        v_matched := TRUE;

        INSERT INTO contauditai.alertas_riesgo
          (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
        VALUES (
          v_tenant_id, 'DISCREPANCIA_BANCARIA', 'MEDIA',
          'Pago parcial: recibido $' || v_tx_monto::text ||
            ' de $' || v_cfdi.total::text || ' MXN (' ||
            ROUND((v_tx_monto / v_cfdi.total) * 100, 1)::text ||
            '%). Saldo pendiente: $' || ROUND(v_cfdi.total - v_tx_monto, 2)::text || ' MXN.',
          v_cfdi.uuid
        );
      END IF;
    END IF;

  END LOOP;

  -- ── 6. Match Global: 1 depósito paga 2 CFDIs ─────────────────
  FOR v_tx IN
    SELECT id, monto, fecha_operacion
    FROM contauditai.transacciones_bancarias
    WHERE tenant_id  = v_tenant_id
      AND tipo       = 'Ingreso'
      AND conciliado = FALSE
  LOOP
    -- Buscar par de CFDIs sin conciliar cuya suma = depósito (±1%)
    SELECT c1.uuid, c1.total, c1.fecha_emision,
           c2.uuid, c2.total, c2.fecha_emision
    INTO   v_uuid1, v_total1, v_fecha1,
           v_uuid2, v_total2, v_fecha2
    FROM contauditai.cfdi_comprobantes c1
    JOIN contauditai.cfdi_comprobantes c2
      ON c2.tenant_id        = v_tenant_id
     AND c2.tipo_comprobante = 'I'
     AND c2.estado_sat       = 'Vigente'
     AND c2.estado_conciliacion = 'Sin_Conciliar'
     AND c2.uuid             > c1.uuid
    WHERE c1.tenant_id        = v_tenant_id
      AND c1.tipo_comprobante = 'I'
      AND c1.estado_sat       = 'Vigente'
      AND c1.estado_conciliacion = 'Sin_Conciliar'
      AND ABS((c1.total + c2.total) - v_tx.monto) / NULLIF(v_tx.monto, 0) <= 0.01
      AND v_tx.fecha_operacion BETWEEN
            LEAST(c1.fecha_emision, c2.fecha_emision) - INTERVAL '7 days'
        AND GREATEST(c1.fecha_emision, c2.fecha_emision) + INTERVAL '45 days'
    LIMIT 1;

    IF v_uuid1 IS NOT NULL THEN
      UPDATE contauditai.transacciones_bancarias SET conciliado = TRUE WHERE id = v_tx.id;

      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_total1, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_uuid1 AND tenant_id = v_tenant_id;
      UPDATE contauditai.cfdi_comprobantes
        SET monto_conciliado = v_total2, estado_conciliacion = 'Conciliado'
        WHERE uuid = v_uuid2 AND tenant_id = v_tenant_id;

      INSERT INTO contauditai.conciliaciones
        (tenant_id, cfdi_uuid, cfdi_fecha_emision, transaccion_id, monto_aplicado, confianza)
      VALUES
        (v_tenant_id, v_uuid1, v_fecha1, v_tx.id, v_total1, 'MEDIA'),
        (v_tenant_id, v_uuid2, v_fecha2, v_tx.id, v_total2, 'MEDIA');

      -- Limpiar variables para siguiente iteración
      v_uuid1 := NULL; v_uuid2 := NULL;
    END IF;
  END LOOP;

  -- ── 7. Huérfano Bancario: depósito sin CFDI ───────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion)
  SELECT
    v_tenant_id, 'INGRESO_NO_FACTURADO', 'MEDIA',
    'Depósito de $' || tb.monto::text ||
      ' MXN del ' || tb.fecha_operacion::DATE::text ||
      ' (Ref: ' || COALESCE(tb.clave_rastreo, 'Sin referencia') || ')' ||
      ' sin CFDI de Ingreso que lo respalde. ¿Venta no facturada o anticipo?'
  FROM contauditai.transacciones_bancarias tb
  WHERE tb.tenant_id  = v_tenant_id
    AND tb.tipo       = 'Ingreso'
    AND tb.conciliado = FALSE;

  -- ── 8. Factura Vencida: CFDI sin pago > 45 días ───────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'FACTURA_VENCIDA', 'BAJA',
    'CFDI de Ingreso por $' || c.total::text ||
      ' MXN del ' || c.fecha_emision::DATE::text ||
      ' lleva ' || EXTRACT(DAY FROM NOW() - c.fecha_emision)::INT::text ||
      ' días sin depósito bancario identificado. Revisar Cuentas por Cobrar.',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id          = v_tenant_id
    AND c.tipo_comprobante   = 'I'
    AND c.estado_sat         = 'Vigente'
    AND c.estado_conciliacion = 'Sin_Conciliar'
    AND c.fecha_emision      < NOW() - INTERVAL '45 days';

  -- ── 9. Contar alertas por severidad ──────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE severidad = 'CRITICA'),
    COUNT(*) FILTER (WHERE severidad = 'MEDIA'),
    COUNT(*) FILTER (WHERE severidad = 'BAJA')
  INTO v_criticas, v_medias, v_bajas
  FROM contauditai.alertas_riesgo
  WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';

  -- ── 10. Risk Score ────────────────────────────────────────────
  v_score := GREATEST(0, 100 - (v_criticas * 15) - (v_medias * 5) - (v_bajas * 1));

  -- ── 11. Guardar score del periodo ────────────────────────────
  INSERT INTO contauditai.risk_scores (tenant_id, periodo, score, factores)
  VALUES (
    v_tenant_id, v_periodo, v_score,
    jsonb_build_object('criticas', v_criticas, 'medias', v_medias, 'bajas', v_bajas)
  )
  ON CONFLICT (tenant_id, periodo) DO UPDATE SET
    score    = EXCLUDED.score,
    factores = EXCLUDED.factores;

  RETURN jsonb_build_object(
    'score',    v_score,
    'criticas', v_criticas,
    'medias',   v_medias,
    'bajas',    v_bajas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.analizar_tenant() TO authenticated;
