-- ============================================================
-- ContAuditAI — Sprint B: ClaveProdServ
-- Agrega clasificación por objeto de gasto SAT a CFDIs.
-- Permite la gráfica "Distribución por Categoría de Gasto"
-- usando los primeros 2 dígitos como división del catálogo SAT.
-- ============================================================

-- ── 1. Nueva columna en cfdi_comprobantes ────────────────────
ALTER TABLE contauditai.cfdi_comprobantes
  ADD COLUMN IF NOT EXISTS clave_prod_serv VARCHAR(8);

-- ── 2. Catálogo de divisiones SAT (primeros 2 dígitos) ───────
CREATE TABLE IF NOT EXISTS contauditai.cat_divisiones_sat (
  division CHAR(2)    PRIMARY KEY,
  nombre   TEXT        NOT NULL
);

INSERT INTO contauditai.cat_divisiones_sat (division, nombre) VALUES
  ('01', 'Genérico / Otros'),
  ('10', 'Minerales y metales'),
  ('11', 'Petróleo, gas y derivados'),
  ('14', 'Papel e impresión'),
  ('20', 'Minería y equipos'),
  ('25', 'Componentes electrónicos'),
  ('27', 'Equipo eléctrico'),
  ('30', 'Elementos estructurales'),
  ('31', 'Materiales manufacturados'),
  ('40', 'Sistemas de distribución'),
  ('43', 'TI, cómputo y telecomunicaciones'),
  ('44', 'Equipo y suministros de oficina'),
  ('46', 'Defensa y seguridad'),
  ('47', 'Limpieza y suministros'),
  ('48', 'Maquinaria industrial'),
  ('50', 'Alimentos, bebidas y tabaco'),
  ('51', 'Farmacéuticos'),
  ('52', 'Artículos domésticos'),
  ('53', 'Ropa y accesorios'),
  ('54', 'Calzado'),
  ('55', 'Productos publicados'),
  ('56', 'Mobiliario e interiores'),
  ('60', 'Materiales de construcción'),
  ('62', 'Agrícola y pecuario'),
  ('70', 'Servicios agrícolas y silvícolas'),
  ('71', 'Minería y recursos forestales'),
  ('72', 'Construcción y mantenimiento de obra'),
  ('73', 'Mantenimiento, reparación e instalación'),
  ('76', 'Servicios industriales'),
  ('77', 'Servicios ambientales'),
  ('78', 'Transporte y logística'),
  ('80', 'Gestión, administración y finanzas'),
  ('81', 'Ingeniería, investigación y tecnología'),
  ('82', 'Editorial, diseño y artes gráficas'),
  ('83', 'Administración pública'),
  ('84', 'Capacitación y enseñanza'),
  ('85', 'Servicios de salud'),
  ('86', 'Servicios sociales'),
  ('90', 'Servicios cívicos y políticos'),
  ('92', 'Recreación y turismo'),
  ('93', 'Hospedaje y alimentos'),
  ('94', 'Servicios personales y domésticos')
ON CONFLICT (division) DO NOTHING;

ALTER TABLE contauditai.cat_divisiones_sat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura publica catalogo sat"
  ON contauditai.cat_divisiones_sat FOR SELECT USING (true);

GRANT SELECT ON contauditai.cat_divisiones_sat TO authenticated;

-- ── 3. insertar_cfdis: agrega clave_prod_serv ─────────────────
-- ON CONFLICT actualiza clave_prod_serv si era NULL
-- para que re-subir XMLs existentes haga backfill.
CREATE OR REPLACE FUNCTION contauditai.insertar_cfdis(p_cfdis JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = contauditai
AS $$
DECLARE
  v_tenant_id  UUID;
  v_insertados INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM contauditai.tenant_users
  WHERE user_id = auth.uid() AND activo = TRUE LIMIT 1;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Sin tenant'; END IF;

  INSERT INTO contauditai.cfdi_comprobantes
    (uuid, tenant_id, rfc_emisor, rfc_receptor, fecha_emision,
     tipo_comprobante, metodo_pago, subtotal, iva, total,
     concepto, isr_retenido, iva_retenido, clave_prod_serv)
  SELECT
    (c->>'uuid')::UUID,
    v_tenant_id,
    c->>'rfc_emisor',
    c->>'rfc_receptor',
    (c->>'fecha_emision')::TIMESTAMPTZ,
    (c->>'tipo_comprobante')::comprobante_tipo,
    CASE WHEN c->>'metodo_pago' != '' THEN (c->>'metodo_pago')::metodo_pago_tipo END,
    (c->>'subtotal')::NUMERIC,
    (c->>'iva')::NUMERIC,
    (c->>'total')::NUMERIC,
    NULLIF(TRIM(c->>'concepto'), ''),
    COALESCE((c->>'isr_retenido')::NUMERIC, 0),
    COALESCE((c->>'iva_retenido')::NUMERIC, 0),
    NULLIF(TRIM(c->>'clave_prod_serv'), '')
  FROM jsonb_array_elements(p_cfdis) c
  ON CONFLICT (uuid, fecha_emision) DO UPDATE
    SET clave_prod_serv = EXCLUDED.clave_prod_serv
    WHERE cfdi_comprobantes.clave_prod_serv IS NULL;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;
  RETURN v_insertados;
END;
$$;

GRANT EXECUTE ON FUNCTION contauditai.insertar_cfdis(JSONB) TO authenticated;
