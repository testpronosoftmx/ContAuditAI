-- ============================================================
-- ContAuditAI — Migración 001: Schema contauditai + tablas
-- Se usa un schema dedicado para coexistir con otros proyectos
-- en el mismo proyecto Supabase.
-- ============================================================

-- ─── Schema ──────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS contauditai;

-- Acceso al schema para los roles de Supabase
GRANT USAGE ON SCHEMA contauditai TO anon, authenticated, service_role;

-- Extensiones (en public — ya existen en Supabase por default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usar contauditai como schema por defecto en esta migración
SET search_path TO contauditai, public;

-- ─── Enum types ──────────────────────────────────────────────
CREATE TYPE plan_tipo AS ENUM ('basic', 'pro', 'enterprise');
CREATE TYPE user_rol AS ENUM ('admin', 'contador', 'cfo', 'auditor', 'readonly');
CREATE TYPE comprobante_tipo AS ENUM ('I', 'E', 'P', 'N', 'T');
CREATE TYPE metodo_pago_tipo AS ENUM ('PUE', 'PPD');
CREATE TYPE estado_sat_tipo AS ENUM ('Vigente', 'Cancelado', 'No_Encontrado');
CREATE TYPE transaccion_tipo AS ENUM ('Ingreso', 'Egreso');
CREATE TYPE materialidad_tipo AS ENUM ('Contrato', 'Bitacora', 'Foto', 'Factura_Respaldo', 'Otro');
CREATE TYPE alerta_tipo AS ENUM (
  'PPD_SIN_CRP',
  'CANCELACION_RETROACTIVA',
  'DISCREPANCIA_BANCARIA',
  'EFOS_DETECTADO',
  'MATERIALIDAD_FALTANTE',
  'VENTANA_72H'
);
CREATE TYPE severidad_tipo AS ENUM ('CRITICA', 'MEDIA', 'BAJA');
CREATE TYPE alerta_estado AS ENUM ('Pendiente', 'Resuelto', 'Ignorado', 'Escalado');
CREATE TYPE efos_tipo AS ENUM ('EFOS', 'EDOS');

-- ─── Tenants (empresas cliente de ContAuditAI) ───────────────
CREATE TABLE tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(200) NOT NULL,
  rfc_empresa VARCHAR(13)  NOT NULL UNIQUE,
  plan        plan_tipo    NOT NULL DEFAULT 'basic',
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Perfiles de usuario (extiende auth.users) ───────────────
CREATE TABLE profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(200),
  avatar_url      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Relación usuario ↔ tenant con rol ───────────────────────
CREATE TABLE tenant_users (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID      NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  user_id    UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        user_rol  NOT NULL DEFAULT 'contador',
  activo     BOOLEAN   NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_user ON contauditai.tenant_users(user_id);

-- ─── CFDI Comprobantes (particionada por año) ─────────────────
CREATE TABLE cfdi_comprobantes (
  uuid                 UUID             NOT NULL,
  tenant_id            UUID             NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  rfc_emisor           VARCHAR(13)      NOT NULL,
  rfc_receptor         VARCHAR(13)      NOT NULL,
  fecha_emision        TIMESTAMPTZ      NOT NULL,
  tipo_comprobante     comprobante_tipo NOT NULL,
  metodo_pago          metodo_pago_tipo,
  subtotal             NUMERIC(15, 2)   NOT NULL DEFAULT 0,
  iva                  NUMERIC(15, 2)   NOT NULL DEFAULT 0,
  total                NUMERIC(15, 2)   NOT NULL,
  estado_sat           estado_sat_tipo  NOT NULL DEFAULT 'Vigente',
  fecha_validacion_sat TIMESTAMPTZ,
  xml_url              TEXT,
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (uuid, fecha_emision)   -- fecha_emision requerida por el particionamiento
) PARTITION BY RANGE (fecha_emision);

CREATE TABLE cfdi_comprobantes_2025 PARTITION OF contauditai.cfdi_comprobantes
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE cfdi_comprobantes_2026 PARTITION OF contauditai.cfdi_comprobantes
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE cfdi_comprobantes_2027 PARTITION OF contauditai.cfdi_comprobantes
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX idx_cfdi_tenant_fecha    ON contauditai.cfdi_comprobantes(tenant_id, fecha_emision DESC);
CREATE INDEX idx_cfdi_tenant_emisor   ON contauditai.cfdi_comprobantes(tenant_id, rfc_emisor);
CREATE INDEX idx_cfdi_tenant_receptor ON contauditai.cfdi_comprobantes(tenant_id, rfc_receptor);
CREATE INDEX idx_cfdi_tenant_estado   ON contauditai.cfdi_comprobantes(tenant_id, estado_sat);
CREATE INDEX idx_cfdi_tenant_metodo   ON contauditai.cfdi_comprobantes(tenant_id, metodo_pago);

-- ─── Transacciones bancarias (SPEI / CSV) ────────────────────
CREATE TABLE transacciones_bancarias (
  id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID             NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  clabe             CHAR(18)         NOT NULL,
  banco             VARCHAR(100),
  fecha_operacion   TIMESTAMPTZ      NOT NULL,
  monto             NUMERIC(15, 2)   NOT NULL,
  tipo              transaccion_tipo NOT NULL,
  concepto_bancario TEXT,
  rfc_contraparte   VARCHAR(13),
  clave_rastreo     VARCHAR(50),
  conciliado        BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banco_tenant_fecha      ON contauditai.transacciones_bancarias(tenant_id, fecha_operacion DESC);
CREATE INDEX idx_banco_tenant_conciliado ON contauditai.transacciones_bancarias(tenant_id, conciliado, tipo);
CREATE INDEX idx_banco_tenant_rfc        ON contauditai.transacciones_bancarias(tenant_id, rfc_contraparte);
CREATE INDEX idx_banco_tenant_monto      ON contauditai.transacciones_bancarias(tenant_id, monto);

-- ─── Complementos de Pago (CRP) ──────────────────────────────
CREATE TABLE cfdi_pagos (
  uuid_pago               UUID           PRIMARY KEY,
  tenant_id               UUID           NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  uuid_relacionado        UUID           NOT NULL,
  fecha_pago              TIMESTAMPTZ    NOT NULL,
  monto_pagado            NUMERIC(15, 2) NOT NULL,
  id_transaccion_bancaria UUID           REFERENCES contauditai.transacciones_bancarias(id),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagos_tenant      ON contauditai.cfdi_pagos(tenant_id);
CREATE INDEX idx_pagos_relacionado ON contauditai.cfdi_pagos(uuid_relacionado);
CREATE INDEX idx_pagos_transaccion ON contauditai.cfdi_pagos(id_transaccion_bancaria);

-- ─── Evidencia de Materialidad (Art. 49-Bis CFF) ─────────────
CREATE TABLE evidencia_materialidad (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID              NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  uuid_cfdi      UUID              NOT NULL,
  tipo_archivo   materialidad_tipo NOT NULL,
  nombre_archivo VARCHAR(255)      NOT NULL,
  url_storage    TEXT              NOT NULL,
  hash_sha256    CHAR(64)          NOT NULL,
  tamano_bytes   BIGINT,
  cargado_por    UUID              REFERENCES auth.users(id),
  fecha_carga    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materialidad_tenant_cfdi ON contauditai.evidencia_materialidad(tenant_id, uuid_cfdi);

-- ─── EFOS / EDOS (lista negra SAT) ───────────────────────────
CREATE TABLE efos_edos (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfc                       VARCHAR(13) NOT NULL UNIQUE,
  nombre_contribuyente      TEXT,
  tipo                      efos_tipo   NOT NULL,
  situacion                 VARCHAR(80),
  numero_en_lista           INTEGER,
  fecha_publicacion_dof     DATE,
  fecha_actualizacion_local TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_efos_rfc  ON contauditai.efos_edos(rfc);
CREATE INDEX idx_efos_tipo ON contauditai.efos_edos(tipo, situacion);

-- ─── Alertas de riesgo ───────────────────────────────────────
CREATE TABLE alertas_riesgo (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID           NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  tipo_alerta         alerta_tipo    NOT NULL,
  severidad           severidad_tipo NOT NULL,
  descripcion         TEXT,
  uuid_referencia     UUID,
  fecha_limite_accion TIMESTAMPTZ,
  estado              alerta_estado  NOT NULL DEFAULT 'Pendiente',
  resuelta_por        UUID           REFERENCES auth.users(id),
  fecha_resolucion    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alertas_tenant_estado ON contauditai.alertas_riesgo(tenant_id, estado, severidad);
CREATE INDEX idx_alertas_tenant_fecha  ON contauditai.alertas_riesgo(tenant_id, fecha_limite_accion);
CREATE INDEX idx_alertas_tenant_tipo   ON contauditai.alertas_riesgo(tenant_id, tipo_alerta);

-- ─── Risk Scores histórico por tenant ────────────────────────
CREATE TABLE risk_scores (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID          NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  periodo    DATE          NOT NULL,
  score      NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  factores   JSONB,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, periodo)
);

CREATE INDEX idx_risk_tenant_periodo ON contauditai.risk_scores(tenant_id, periodo DESC);

-- ─── Trigger: updated_at automático ──────────────────────────
CREATE OR REPLACE FUNCTION contauditai.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = contauditai, public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON contauditai.tenants
  FOR EACH ROW EXECUTE FUNCTION contauditai.update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON contauditai.profiles
  FOR EACH ROW EXECUTE FUNCTION contauditai.update_updated_at();

-- ─── Trigger: crear profile al registrar usuario ─────────────
-- Vive en public para que auth lo pueda invocar, pero escribe
-- en contauditai.profiles con search_path explícito.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai, public AS $$
BEGIN
  INSERT INTO contauditai.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── GRANTs de tablas (para PostgREST / Data API) ────────────
GRANT ALL ON ALL TABLES    IN SCHEMA contauditai TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA contauditai TO authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA contauditai TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA contauditai TO service_role;
