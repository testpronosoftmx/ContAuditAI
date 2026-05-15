-- ============================================================
-- ContAuditAI — analizar_tenant: motor de conciliación + riesgo
-- Lógica: EFOS → PPD sin CRP → Conciliación Banco↔CFDI → Score
-- ============================================================

SET search_path TO contauditai, public;

CREATE OR REPLACE FUNCTION contauditai.analizar_tenant()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = contauditai, public
AS $$
DECLARE
  v_tenant_id UUID;
  v_periodo   DATE;
  v_cfdi      RECORD;
  v_tx_id     UUID;
  v_tx_monto  NUMERIC;
  v_matched   BOOLEAN;
  v_diff      NUMERIC;
  v_criticas  INT;
  v_medias    INT;
  v_bajas     INT;
  v_score     NUMERIC;
BEGIN
  v_periodo := DATE_TRUNC('month', NOW())::DATE;

  -- ── 0. Obtener tenant del usuario actual ─────────────────────
  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tenant activo para el usuario';
  END IF;

  -- ── 1. Limpiar alertas pendientes anteriores (análisis fresco) ─
  DELETE FROM contauditai.alertas_riesgo
  WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';

  -- ── 2. EFOS / EDOS: RFC emisor en lista negra SAT ─────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id,
    'EFOS_DETECTADO',
    'CRITICA',
    'RFC emisor ' || c.rfc_emisor ||
      ' (' || COALESCE(e.nombre_contribuyente, 'Sin nombre') || ')' ||
      ' está en lista ' || e.tipo::text || ' del SAT',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_emisor
  WHERE c.tenant_id = v_tenant_id;

  -- EFOS: RFC receptor en lista negra
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id,
    'EFOS_DETECTADO',
    'CRITICA',
    'RFC receptor ' || c.rfc_receptor ||
      ' (' || COALESCE(e.nombre_contribuyente, 'Sin nombre') || ')' ||
      ' está en lista ' || e.tipo::text || ' del SAT',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_receptor
  WHERE c.tenant_id = v_tenant_id;

  -- ── 3. PPD sin Complemento de Pago ───────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia, fecha_limite_accion)
  SELECT
    v_tenant_id,
    'PPD_SIN_CRP',
    'MEDIA',
    'Factura PPD por $' || c.total::text ||
      ' MXN del ' || c.fecha_emision::DATE::text ||
      ' sin Complemento de Pago registrado',
    c.uuid,
    c.fecha_emision + INTERVAL '72 hours'
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id       = v_tenant_id
    AND c.metodo_pago     = 'PPD'
    AND c.tipo_comprobante = 'I'
    AND c.estado_sat      = 'Vigente'
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.cfdi_pagos p
      WHERE p.uuid_relacionado = c.uuid
        AND p.tenant_id        = v_tenant_id
    );

  -- ── 4. Cancelaciones retroactivas ────────────────────────────
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id,
    'CANCELACION_RETROACTIVA',
    'MEDIA',
    'CFDI por $' || c.total::text || ' MXN fue cancelado más de 30 días después de su emisión (' ||
      c.fecha_emision::DATE::text || ')',
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  WHERE c.tenant_id    = v_tenant_id
    AND c.estado_sat   = 'Cancelado'
    AND c.fecha_validacion_sat IS NOT NULL
    AND c.fecha_validacion_sat > c.fecha_emision + INTERVAL '30 days';

  -- ── 5. Conciliación Banco ↔ CFDIs de Ingreso ─────────────────
  -- Reset: marcar todos los abonos como no conciliados para análisis fresco
  UPDATE contauditai.transacciones_bancarias
  SET conciliado = FALSE
  WHERE tenant_id = v_tenant_id AND tipo = 'Ingreso';

  FOR v_cfdi IN
    SELECT uuid, total, fecha_emision
    FROM contauditai.cfdi_comprobantes
    WHERE tenant_id        = v_tenant_id
      AND tipo_comprobante = 'I'
      AND estado_sat       = 'Vigente'
    ORDER BY fecha_emision DESC
  LOOP
    v_matched := FALSE;

    -- P1: UUID del CFDI en concepto_bancario o clave_rastreo
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
      UPDATE contauditai.transacciones_bancarias
      SET conciliado = TRUE WHERE id = v_tx_id;
      v_matched := TRUE;
    END IF;

    -- P2: Monto exacto + ventana de fechas (±7 días antes, 30 días después)
    IF NOT v_matched THEN
      SELECT id INTO v_tx_id
      FROM contauditai.transacciones_bancarias
      WHERE tenant_id  = v_tenant_id
        AND tipo       = 'Ingreso'
        AND conciliado = FALSE
        AND monto      = v_cfdi.total
        AND fecha_operacion BETWEEN v_cfdi.fecha_emision - INTERVAL '7 days'
                                AND v_cfdi.fecha_emision + INTERVAL '30 days'
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        UPDATE contauditai.transacciones_bancarias
        SET conciliado = TRUE WHERE id = v_tx_id;
        v_matched := TRUE;
      END IF;
    END IF;

    -- P2.5: Monto con tolerancia ≤1% + ventana amplia (±15 días / 45 días)
    --       Diferencia < $1 → se concilia sin alerta (centavos)
    --       Diferencia ≥ $1 → se concilia pero genera alerta BAJA
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
        UPDATE contauditai.transacciones_bancarias
        SET conciliado = TRUE WHERE id = v_tx_id;
        v_matched := TRUE;

        -- Sólo alerta si la diferencia es ≥ $1 (centavos se cierran automático)
        IF v_diff >= 1.00 THEN
          INSERT INTO contauditai.alertas_riesgo
            (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
          VALUES (
            v_tenant_id,
            'DISCREPANCIA_BANCARIA',
            'BAJA',
            'Diferencia de $' || ROUND(v_diff, 2)::text ||
              ' MXN entre CFDI ($' || v_cfdi.total::text ||
              ') y depósito bancario. ¿Conciliar con diferencia?',
            v_cfdi.uuid
          );
        END IF;
      END IF;
    END IF;

    -- P3: Sin match → alerta de discrepancia bancaria
    IF NOT v_matched THEN
      INSERT INTO contauditai.alertas_riesgo
        (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
      VALUES (
        v_tenant_id,
        'DISCREPANCIA_BANCARIA',
        'MEDIA',
        'CFDI de Ingreso por $' || v_cfdi.total::text ||
          ' MXN del ' || v_cfdi.fecha_emision::DATE::text ||
          ' sin depósito bancario identificado. Requiere revisión.',
        v_cfdi.uuid
      );
    END IF;

  END LOOP;

  -- ── 6. Contar alertas por severidad ──────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE severidad = 'CRITICA'),
    COUNT(*) FILTER (WHERE severidad = 'MEDIA'),
    COUNT(*) FILTER (WHERE severidad = 'BAJA')
  INTO v_criticas, v_medias, v_bajas
  FROM contauditai.alertas_riesgo
  WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';

  -- ── 7. Calcular Risk Score ────────────────────────────────────
  -- Fórmula: 100 - (críticas × 15) - (medias × 5) - (bajas × 1), mínimo 0
  v_score := GREATEST(0, 100 - (v_criticas * 15) - (v_medias * 5) - (v_bajas * 1));

  -- ── 8. Guardar / actualizar risk score del periodo ────────────
  INSERT INTO contauditai.risk_scores (tenant_id, periodo, score, factores)
  VALUES (
    v_tenant_id,
    v_periodo,
    v_score,
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

-- Permitir que usuarios autenticados ejecuten la función
GRANT EXECUTE ON FUNCTION contauditai.analizar_tenant() TO authenticated;
