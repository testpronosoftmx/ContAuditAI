-- ============================================================
-- ContAuditAI — Migración: schema de conciliación avanzada
-- Tabla conciliaciones + campos en CFDIs + nuevos enum values
-- ============================================================

-- ─── Nuevos valores en alerta_tipo ───────────────────────────
ALTER TYPE contauditai.alerta_tipo ADD VALUE IF NOT EXISTS 'INGRESO_NO_FACTURADO';
ALTER TYPE contauditai.alerta_tipo ADD VALUE IF NOT EXISTS 'FACTURA_VENCIDA';

-- ─── Campos de conciliación en cfdi_comprobantes ─────────────
ALTER TABLE contauditai.cfdi_comprobantes
  ADD COLUMN IF NOT EXISTS monto_conciliado    NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_conciliacion VARCHAR(15)   NOT NULL DEFAULT 'Sin_Conciliar';
-- estado_conciliacion values: Sin_Conciliar | Parcial | Conciliado | Con_Diferencia

-- ─── Tabla puente many-to-many: conciliaciones ───────────────
CREATE TABLE IF NOT EXISTS contauditai.conciliaciones (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID           NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  cfdi_uuid           UUID           NOT NULL,
  cfdi_fecha_emision  TIMESTAMPTZ    NOT NULL,
  transaccion_id      UUID           NOT NULL REFERENCES contauditai.transacciones_bancarias(id) ON DELETE CASCADE,
  monto_aplicado      NUMERIC(15,2)  NOT NULL,
  confianza           VARCHAR(5)     NOT NULL CHECK (confianza IN ('ALTA','MEDIA','BAJA')),
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conciliaciones_tenant      ON contauditai.conciliaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_cfdi        ON contauditai.conciliaciones(cfdi_uuid);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_transaccion ON contauditai.conciliaciones(transaccion_id);

ALTER TABLE contauditai.conciliaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_conciliaciones"
  ON contauditai.conciliaciones FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = TRUE
    )
  );

GRANT ALL ON contauditai.conciliaciones TO authenticated, service_role;
