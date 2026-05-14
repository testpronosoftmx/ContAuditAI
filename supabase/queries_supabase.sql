-- ============================================================
-- ContAuditAI — Queries para ejecutar en Supabase SQL Editor
-- Ejecutar en orden. Los que ya corriste están marcados con ✓
-- ============================================================


-- ✓ Q1: Migración 004 — RLS INSERT para onboarding
-- ============================================================
CREATE POLICY "tenant: crear"
  ON contauditai.tenants FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "tenant_users: auto-registro"
  ON contauditai.tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = TRUE
    )
  );


-- ✓ Q2: GRANTs para schema contauditai
-- ============================================================
GRANT USAGE ON SCHEMA contauditai TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA contauditai TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA contauditai TO authenticated;


-- ✓ Q3: Función crear_tenant_inicial (onboarding RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION contauditai.crear_tenant_inicial(
  p_rfc  TEXT,
  p_nombre TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF EXISTS (
    SELECT 1 FROM contauditai.tenant_users
    WHERE user_id = auth.uid() AND activo = TRUE
  ) THEN RAISE EXCEPTION 'El usuario ya tiene un tenant'; END IF;

  INSERT INTO contauditai.tenants (rfc_empresa, nombre)
  VALUES (p_rfc, p_nombre) RETURNING id INTO v_tenant_id;

  INSERT INTO contauditai.tenant_users (tenant_id, user_id, rol)
  VALUES (v_tenant_id, auth.uid(), 'admin');

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.crear_tenant_inicial(TEXT, TEXT) TO authenticated;


-- ✓ Q4: Función insertar_cfdis (upload de XMLs)
-- ============================================================
CREATE OR REPLACE FUNCTION contauditai.insertar_cfdis(p_cfdis JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE
  v_tenant_id UUID;
  v_insertados INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE LIMIT 1;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Sin tenant'; END IF;

  INSERT INTO contauditai.cfdi_comprobantes
    (uuid, tenant_id, rfc_emisor, rfc_receptor, fecha_emision,
     tipo_comprobante, metodo_pago, subtotal, iva, total)
  SELECT
    (c->>'uuid')::UUID,
    v_tenant_id,
    c->>'rfc_emisor',
    c->>'rfc_receptor',
    (c->>'fecha_emision')::TIMESTAMPTZ,
    (c->>'tipo_comprobante')::comprobante_tipo,
    CASE WHEN c->>'metodo_pago' != '' THEN (c->>'metodo_pago')::metodo_pago_tipo END,
    (c->>'subtotal')::NUMERIC,
    (c->>'iva')::NUMERIC,
    (c->>'total')::NUMERIC
  FROM jsonb_array_elements(p_cfdis) c
  ON CONFLICT (uuid, fecha_emision) DO NOTHING;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;
  RETURN v_insertados;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.insertar_cfdis(JSONB) TO authenticated;


-- ✓ Q5: Función insertar_transacciones (upload de CSV banco)
-- ============================================================
CREATE OR REPLACE FUNCTION contauditai.insertar_transacciones(
  p_rows  JSONB,
  p_clabe TEXT,
  p_banco TEXT
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE
  v_tenant_id UUID;
  v_insertados INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE LIMIT 1;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Sin tenant'; END IF;

  INSERT INTO contauditai.transacciones_bancarias
    (tenant_id, clabe, banco, fecha_operacion, monto, tipo, concepto_bancario, clave_rastreo)
  SELECT
    v_tenant_id,
    p_clabe,
    NULLIF(p_banco, ''),
    (r->>'fecha_operacion')::TIMESTAMPTZ,
    (r->>'monto')::NUMERIC,
    (r->>'tipo')::transaccion_tipo,
    r->>'concepto_bancario',
    NULLIF(r->>'clave_rastreo', '')
  FROM jsonb_array_elements(p_rows) r;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;
  RETURN v_insertados;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.insertar_transacciones(JSONB, TEXT, TEXT) TO authenticated;


-- ⬜ Q6: Función analizar_tenant (motor de alertas y Risk Score)
-- ============================================================
CREATE OR REPLACE FUNCTION contauditai.analizar_tenant()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE
  v_tenant_id UUID;
  v_criticas  INTEGER := 0;
  v_medias    INTEGER := 0;
  v_score     NUMERIC;
  v_periodo   DATE := DATE_TRUNC('month', NOW())::DATE;
  v_n         INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE LIMIT 1;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Sin tenant'; END IF;

  DELETE FROM contauditai.alertas_riesgo
  WHERE tenant_id = v_tenant_id AND estado = 'Pendiente';

  -- EFOS_DETECTADO
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'EFOS_DETECTADO', 'CRITICA',
    'Proveedor en lista negra SAT (' || e.tipo || '): ' ||
    COALESCE(e.nombre_contribuyente, e.rfc) ||
    ' — CFDI por ' || TO_CHAR(c.total, 'FM$999,999,990.00'),
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  JOIN contauditai.efos_edos e ON e.rfc = c.rfc_emisor
  WHERE c.tenant_id = v_tenant_id;
  GET DIAGNOSTICS v_criticas = ROW_COUNT;

  -- PPD_SIN_CRP
  INSERT INTO contauditai.alertas_riesgo
    (tenant_id, tipo_alerta, severidad, descripcion, uuid_referencia)
  SELECT
    v_tenant_id, 'PPD_SIN_CRP', 'MEDIA',
    'CFDI PPD sin Complemento de Recibo de Pago — ' ||
    c.rfc_emisor || ' → ' || c.rfc_receptor ||
    ' ' || TO_CHAR(c.total, 'FM$999,999,990.00'),
    c.uuid
  FROM contauditai.cfdi_comprobantes c
  LEFT JOIN contauditai.cfdi_pagos p ON p.uuid_relacionado = c.uuid
  WHERE c.tenant_id = v_tenant_id
    AND c.metodo_pago = 'PPD'
    AND p.uuid_pago IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_medias := v_medias + v_n;

  -- Risk Score
  v_score := GREATEST(0, LEAST(100,
    100 - LEAST(30, v_criticas * 10) - LEAST(40, v_medias * 2)
  ));

  INSERT INTO contauditai.risk_scores (tenant_id, periodo, score, factores)
  VALUES (
    v_tenant_id, v_periodo, v_score,
    jsonb_build_object(
      'criticas', v_criticas, 'medias', v_medias,
      'total_cfdis', (SELECT COUNT(*) FROM contauditai.cfdi_comprobantes WHERE tenant_id = v_tenant_id),
      'total_txs',   (SELECT COUNT(*) FROM contauditai.transacciones_bancarias WHERE tenant_id = v_tenant_id)
    )
  )
  ON CONFLICT (tenant_id, periodo)
  DO UPDATE SET score = EXCLUDED.score, factores = EXCLUDED.factores;

  RETURN jsonb_build_object('score', v_score, 'criticas', v_criticas, 'medias', v_medias);
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.analizar_tenant() TO authenticated;


-- ⬜ Q7: Función resolver_alerta (marcar alerta como resuelta/ignorada)
-- ============================================================
CREATE OR REPLACE FUNCTION contauditai.resolver_alerta(
  p_alerta_id UUID,
  p_estado    TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE LIMIT 1;

  UPDATE contauditai.alertas_riesgo
  SET estado           = p_estado::alerta_estado,
      resuelta_por     = auth.uid(),
      fecha_resolucion = NOW()
  WHERE id = p_alerta_id AND tenant_id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.resolver_alerta(UUID, TEXT) TO authenticated;
