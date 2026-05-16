-- ============================================================
-- ContAuditAI — v7
-- Índice de soporte para filtrado de conciliaciones por confianza
-- Los KPIs del dashboard y la página de conciliaciones filtran
-- solo confianza = 'ALTA' para el conteo de "confirmadas".
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_conciliaciones_tenant_confianza
  ON contauditai.conciliaciones (tenant_id, confianza);
