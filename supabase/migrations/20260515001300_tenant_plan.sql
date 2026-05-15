-- ============================================================
-- ContAuditAI — Planes de suscripción
-- ============================================================

ALTER TABLE contauditai.tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'gratis'
    CHECK (plan IN ('gratis', 'plata', 'oro'));

-- Tenants existentes en desarrollo arrancan en 'oro' para probar todo
UPDATE contauditai.tenants SET plan = 'oro';
