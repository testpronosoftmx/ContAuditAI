-- ============================================================
-- ContAuditAI — Migración 004: RLS INSERT para onboarding
-- Permite crear el primer tenant sin tener uno previo.
-- ============================================================

-- Cualquier usuario autenticado puede crear un tenant.
-- El SELECT ya está restringido a "ver solo el propio".
CREATE POLICY "tenant: crear"
  ON contauditai.tenants FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Usuario puede registrarse en un tenant SOLO si aún no pertenece a ninguno.
-- Evita que alguien se agregue a un tenant ajeno conociendo el tenant_id.
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
