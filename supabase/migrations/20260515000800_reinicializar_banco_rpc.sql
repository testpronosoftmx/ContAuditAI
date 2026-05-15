-- ============================================================
-- ContAuditAI — RPC reinicializar_banco()
-- Borra transacciones bancarias y resetea estado de conciliación
-- en CFDIs. Conciliaciones se borran por CASCADE desde banco.
-- ============================================================

CREATE OR REPLACE FUNCTION contauditai.reinicializar_banco()
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

  -- conciliaciones se borra por ON DELETE CASCADE desde transacciones_bancarias
  DELETE FROM contauditai.transacciones_bancarias WHERE tenant_id = v_tenant_id;

  -- resetear estado de conciliación en CFDIs
  UPDATE contauditai.cfdi_comprobantes
  SET monto_conciliado = 0, estado_conciliacion = 'Sin_Conciliar'
  WHERE tenant_id = v_tenant_id;

  -- alertas y scores ya no son válidos sin conciliación
  DELETE FROM contauditai.alertas_riesgo WHERE tenant_id = v_tenant_id;
  DELETE FROM contauditai.risk_scores     WHERE tenant_id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.reinicializar_banco() TO authenticated;
