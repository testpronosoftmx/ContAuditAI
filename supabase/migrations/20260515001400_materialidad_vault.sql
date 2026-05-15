-- ============================================================
-- ContAuditAI — Vault de Materialidad
-- Tabla para adjuntar evidencia documental por CFDI (Art. 49-Bis CFF)
-- ============================================================

CREATE TABLE IF NOT EXISTS contauditai.materialidad_evidencias (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES contauditai.tenants(id) ON DELETE CASCADE,
  cfdi_uuid    TEXT        NOT NULL,
  nombre       TEXT        NOT NULL,
  tipo_mime    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  subido_por   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mat_ev_tenant_cfdi
  ON contauditai.materialidad_evidencias (tenant_id, cfdi_uuid);

ALTER TABLE contauditai.materialidad_evidencias ENABLE ROW LEVEL SECURITY;

-- Policies: solo el tenant al que pertenece puede ver y escribir sus evidencias
CREATE POLICY "tenant puede ver sus evidencias"
  ON contauditai.materialidad_evidencias
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "tenant puede insertar evidencias"
  ON contauditai.materialidad_evidencias
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "tenant puede eliminar sus evidencias"
  ON contauditai.materialidad_evidencias
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Storage bucket privado para evidencias
INSERT INTO storage.buckets (id, name, public)
VALUES ('materialidad', 'materialidad', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "tenant puede subir evidencias"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'materialidad'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "tenant puede leer sus evidencias"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'materialidad'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "tenant puede eliminar sus evidencias storage"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'materialidad'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM contauditai.tenant_users
      WHERE user_id = auth.uid() AND activo = true
    )
  );
