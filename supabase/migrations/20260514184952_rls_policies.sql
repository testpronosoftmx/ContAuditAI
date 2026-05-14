-- ============================================================
-- ContAuditAI — Migración 002: RLS y permisos
-- ============================================================

-- ─── Función helper: tenant del usuario actual ───────────────
-- Devuelve el tenant_id del usuario autenticado.
-- Se llama desde las políticas RLS para evitar subqueries repetidas.
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT tenant_id
  FROM tenant_users
  WHERE user_id = auth.uid()
    AND activo = TRUE
  LIMIT 1;
$$;

-- ─── Función helper: rol del usuario en su tenant ────────────
CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS user_rol LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT rol
  FROM tenant_users
  WHERE user_id = auth.uid()
    AND activo = TRUE
  LIMIT 1;
$$;

-- ─── Habilitar RLS en todas las tablas ───────────────────────
ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfdi_comprobantes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfdi_pagos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencia_materialidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_riesgo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE efos_edos             ENABLE ROW LEVEL SECURITY;

-- ─── TENANTS ─────────────────────────────────────────────────
-- Solo ver el tenant propio
CREATE POLICY "tenant: ver propio"
  ON tenants FOR SELECT
  USING (id = get_user_tenant_id());

-- Solo admin puede editar datos del tenant
CREATE POLICY "tenant: editar solo admin"
  ON tenants FOR UPDATE
  USING (id = get_user_tenant_id() AND get_user_rol() = 'admin');

-- ─── PROFILES ────────────────────────────────────────────────
CREATE POLICY "profile: ver propio"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profile: editar propio"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ─── TENANT_USERS ────────────────────────────────────────────
-- Cualquier miembro ve a los demás miembros de su tenant
CREATE POLICY "tenant_users: ver miembros del tenant"
  ON tenant_users FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Solo admin puede agregar o modificar usuarios
CREATE POLICY "tenant_users: admin gestiona"
  ON tenant_users FOR ALL
  USING (tenant_id = get_user_tenant_id() AND get_user_rol() = 'admin');

-- ─── CFDI_COMPROBANTES ───────────────────────────────────────
CREATE POLICY "cfdi: ver del tenant"
  ON cfdi_comprobantes FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Contador, admin y cfo pueden insertar/actualizar
CREATE POLICY "cfdi: escribir roles permitidos"
  ON cfdi_comprobantes FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_rol() IN ('admin', 'contador', 'cfo')
  );

CREATE POLICY "cfdi: actualizar roles permitidos"
  ON cfdi_comprobantes FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (get_user_rol() IN ('admin', 'contador', 'cfo'));

-- ─── TRANSACCIONES_BANCARIAS ─────────────────────────────────
CREATE POLICY "banco: ver del tenant"
  ON transacciones_bancarias FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "banco: escribir roles permitidos"
  ON transacciones_bancarias FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_rol() IN ('admin', 'contador', 'cfo')
  );

CREATE POLICY "banco: actualizar conciliacion"
  ON transacciones_bancarias FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (get_user_rol() IN ('admin', 'contador', 'cfo'));

-- ─── CFDI_PAGOS ──────────────────────────────────────────────
CREATE POLICY "pagos: ver del tenant"
  ON cfdi_pagos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "pagos: escribir roles permitidos"
  ON cfdi_pagos FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_rol() IN ('admin', 'contador', 'cfo')
  );

-- ─── EVIDENCIA_MATERIALIDAD ──────────────────────────────────
CREATE POLICY "materialidad: ver del tenant"
  ON evidencia_materialidad FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Cualquier rol activo puede subir evidencia (readonly no)
CREATE POLICY "materialidad: subir archivo"
  ON evidencia_materialidad FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_rol() != 'readonly'
  );

CREATE POLICY "materialidad: eliminar solo admin"
  ON evidencia_materialidad FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND get_user_rol() = 'admin');

-- ─── ALERTAS_RIESGO ──────────────────────────────────────────
CREATE POLICY "alertas: ver del tenant"
  ON alertas_riesgo FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- El sistema (service_role) inserta alertas — usuarios solo actualizan estado
CREATE POLICY "alertas: resolver"
  ON alertas_riesgo FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (get_user_rol() IN ('admin', 'contador', 'cfo', 'auditor'));

-- ─── RISK_SCORES ─────────────────────────────────────────────
CREATE POLICY "risk_scores: ver del tenant"
  ON risk_scores FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- ─── EFOS_EDOS ───────────────────────────────────────────────
-- Tabla pública de consulta — todos los usuarios autenticados pueden leer
CREATE POLICY "efos: lectura publica autenticada"
  ON efos_edos FOR SELECT
  TO authenticated
  USING (TRUE);

-- Solo service_role escribe (via worker de actualización SAT)

-- ─── GRANTs al rol authenticated ─────────────────────────────
GRANT SELECT, INSERT, UPDATE ON tenants               TO authenticated;
GRANT SELECT, UPDATE         ON profiles              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tenant_users          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cfdi_comprobantes     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON transacciones_bancarias TO authenticated;
GRANT SELECT, INSERT         ON cfdi_pagos            TO authenticated;
GRANT SELECT, INSERT, DELETE ON evidencia_materialidad TO authenticated;
GRANT SELECT, UPDATE         ON alertas_riesgo        TO authenticated;
GRANT SELECT                 ON risk_scores           TO authenticated;
GRANT SELECT                 ON efos_edos             TO authenticated;
