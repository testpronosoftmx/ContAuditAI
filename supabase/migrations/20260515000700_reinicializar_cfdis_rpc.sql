-- ============================================================
-- ContAuditAI — RPC reinicializar_cfdis()
-- SECURITY DEFINER para bypassear RLS en DELETE
-- ============================================================

CREATE OR REPLACE FUNCTION contauditai.reinicializar_cfdis()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = contauditai, public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tenant activo para el usuario';
  END IF;

  DELETE FROM contauditai.conciliaciones          WHERE tenant_id = v_tenant_id;
  DELETE FROM contauditai.alertas_riesgo          WHERE tenant_id = v_tenant_id;
  DELETE FROM contauditai.risk_scores             WHERE tenant_id = v_tenant_id;
  DELETE FROM contauditai.cfdi_pagos              WHERE tenant_id = v_tenant_id;
  DELETE FROM contauditai.cfdi_comprobantes       WHERE tenant_id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.reinicializar_cfdis() TO authenticated;
