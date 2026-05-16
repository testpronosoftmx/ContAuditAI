-- ============================================================
-- ContAuditAI — Configuración de Auditoría por Tenant
-- Parámetros de "apetito de riesgo" personalizables por contador.
-- El motor analizar_tenant() los lee en cada ejecución.
-- ============================================================

CREATE TABLE IF NOT EXISTS contauditai.configuracion_tenant (
  tenant_id             UUID        PRIMARY KEY REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  discrepancia_minima   NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  dias_factura_vencida  INTEGER       NOT NULL DEFAULT 30,
  monto_materialidad    NUMERIC(15,2) NOT NULL DEFAULT 20000.00,
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE contauditai.configuracion_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant puede ver su configuracion"
  ON contauditai.configuracion_tenant FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM contauditai.tenant_users
    WHERE user_id = auth.uid() AND activo = true
  ));

CREATE POLICY "tenant puede insertar su configuracion"
  ON contauditai.configuracion_tenant FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM contauditai.tenant_users
    WHERE user_id = auth.uid() AND activo = true
  ));

CREATE POLICY "tenant puede actualizar su configuracion"
  ON contauditai.configuracion_tenant FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM contauditai.tenant_users
    WHERE user_id = auth.uid() AND activo = true
  ));

-- RPC para guardar configuración (upsert seguro desde el cliente)
CREATE OR REPLACE FUNCTION contauditai.guardar_configuracion(
  p_discrepancia_minima  NUMERIC,
  p_dias_factura_vencida INTEGER,
  p_monto_materialidad   NUMERIC
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sin tenant activo';
  END IF;

  -- Validaciones de rango mínimo para no romper el motor
  IF p_discrepancia_minima < 0      THEN RAISE EXCEPTION 'discrepancia_minima debe ser >= 0'; END IF;
  IF p_dias_factura_vencida < 1     THEN RAISE EXCEPTION 'dias_factura_vencida debe ser >= 1'; END IF;
  IF p_monto_materialidad < 1000    THEN RAISE EXCEPTION 'monto_materialidad debe ser >= 1000'; END IF;

  INSERT INTO contauditai.configuracion_tenant
    (tenant_id, discrepancia_minima, dias_factura_vencida, monto_materialidad, updated_at)
  VALUES
    (v_tenant_id, p_discrepancia_minima, p_dias_factura_vencida, p_monto_materialidad, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET discrepancia_minima  = EXCLUDED.discrepancia_minima,
        dias_factura_vencida = EXCLUDED.dias_factura_vencida,
        monto_materialidad   = EXCLUDED.monto_materialidad,
        updated_at           = now();
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.guardar_configuracion(NUMERIC, INTEGER, NUMERIC) TO authenticated;
