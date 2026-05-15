-- ============================================================
-- ContAuditAI — Renombrar valores del enum plan_tipo
-- El schema ya tiene plan_tipo ('basic','pro','enterprise')
-- y tenants.plan de ese tipo. Solo renombramos los valores.
-- ============================================================

ALTER TYPE contauditai.plan_tipo RENAME VALUE 'basic'      TO 'gratis';
ALTER TYPE contauditai.plan_tipo RENAME VALUE 'pro'        TO 'plata';
ALTER TYPE contauditai.plan_tipo RENAME VALUE 'enterprise' TO 'oro';

-- Tenants existentes en desarrollo arrancan en 'oro'
UPDATE contauditai.tenants SET plan = 'oro';
