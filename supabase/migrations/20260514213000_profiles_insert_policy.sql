-- ContAuditAI — Migración 005: RLS INSERT para profiles
-- El perfil se crea silenciosamente desde el callback de auth
-- (patrón LigaKit: no trigger, solo usuarios reales quedan en la tabla).

CREATE POLICY "profile: crear propio"
  ON contauditai.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
