-- ============================================================
-- ContAuditAI — Migración 002: RLS y permisos (schema contauditai)
-- ============================================================

SET search_path TO contauditai, public;

-- ─── Funciones helper (en public para que RLS las encuentre) ──

-- Devuelve el tenant_id del usuario autenticado actual
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = contauditai, public AS $$
  SELECT tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid()
    AND activo = TRUE
  LIMIT 1;
$$;

-- Devuelve el rol del usuario en su tenant
CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS contauditai.user_rol LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = contauditai, public AS $$
  SELECT rol
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid()
    AND activo = TRUE
  LIMIT 1;
$$;

-- ─── Habilitar RLS ────────────────────────────────────────────
ALTER TABLE contauditai.tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.tenant_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.cfdi_comprobantes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.transacciones_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.cfdi_pagos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.evidencia_materialidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.alertas_riesgo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.risk_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contauditai.efos_edos              ENABLE ROW LEVEL SECURITY;

-- ─── TENANTS ─────────────────────────────────────────────────
CREATE POLICY "tenant: ver propio"
  ON contauditai.tenants FOR SELECT
  USING (id = public.get_user_tenant_id());

CREATE POLICY "tenant: editar solo admin"
  ON contauditai.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id() AND public.get_user_rol() = 'admin');

-- ─── PROFILES ────────────────────────────────────────────────
CREATE POLICY "profile: ver propio"
  ON contauditai.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profile: editar propio"
  ON contauditai.profiles FOR UPDATE
  USING (id = auth.uid());

-- ─── TENANT_USERS ────────────────────────────────────────────
CREATE POLICY "tenant_users: ver miembros del tenant"
  ON contauditai.tenant_users FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_users: admin gestiona"
  ON contauditai.tenant_users FOR ALL
  USING (tenant_id = public.get_user_tenant_id() AND public.get_user_rol() = 'admin');

-- ─── CFDI_COMPROBANTES ───────────────────────────────────────
CREATE POLICY "cfdi: ver del tenant"
  ON contauditai.cfdi_comprobantes FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "cfdi: escribir roles permitidos"
  ON contauditai.cfdi_comprobantes FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_rol() IN ('admin', 'contador', 'cfo')
  );

CREATE POLICY "cfdi: actualizar roles permitidos"
  ON contauditai.cfdi_comprobantes FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (public.get_user_rol() IN ('admin', 'contador', 'cfo'));

-- ─── TRANSACCIONES_BANCARIAS ─────────────────────────────────
CREATE POLICY "banco: ver del tenant"
  ON contauditai.transacciones_bancarias FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "banco: escribir roles permitidos"
  ON contauditai.transacciones_bancarias FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_rol() IN ('admin', 'contador', 'cfo')
  );

CREATE POLICY "banco: actualizar conciliacion"
  ON contauditai.transacciones_bancarias FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (public.get_user_rol() IN ('admin', 'contador', 'cfo'));

-- ─── CFDI_PAGOS ──────────────────────────────────────────────
CREATE POLICY "pagos: ver del tenant"
  ON contauditai.cfdi_pagos FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "pagos: escribir roles permitidos"
  ON contauditai.cfdi_pagos FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_rol() IN ('admin', 'contador', 'cfo')
  );

-- ─── EVIDENCIA_MATERIALIDAD ──────────────────────────────────
CREATE POLICY "materialidad: ver del tenant"
  ON contauditai.evidencia_materialidad FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "materialidad: subir archivo"
  ON contauditai.evidencia_materialidad FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_rol() != 'readonly'
  );

CREATE POLICY "materialidad: eliminar solo admin"
  ON contauditai.evidencia_materialidad FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.get_user_rol() = 'admin');

-- ─── ALERTAS_RIESGO ──────────────────────────────────────────
CREATE POLICY "alertas: ver del tenant"
  ON contauditai.alertas_riesgo FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "alertas: resolver"
  ON contauditai.alertas_riesgo FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (public.get_user_rol() IN ('admin', 'contador', 'cfo', 'auditor'));

-- ─── RISK_SCORES ─────────────────────────────────────────────
CREATE POLICY "risk_scores: ver del tenant"
  ON contauditai.risk_scores FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

-- ─── EFOS_EDOS ───────────────────────────────────────────────
-- Lectura para cualquier usuario autenticado; escritura solo service_role
CREATE POLICY "efos: lectura autenticada"
  ON contauditai.efos_edos FOR SELECT
  TO authenticated
  USING (TRUE);
