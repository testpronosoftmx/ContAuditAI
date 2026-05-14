-- ============================================================
-- ContAuditAI — Migración 003: Seed EFOS/EDOS (desarrollo)
-- Los datos reales se cargan via worker desde el SAT.
-- ============================================================

INSERT INTO contauditai.efos_edos
  (rfc, nombre_contribuyente, tipo, situacion, numero_en_lista, fecha_publicacion_dof)
VALUES
  ('AAA010101AAA', 'EMPRESA FANTASMA DEMO SA DE CV',         'EFOS', 'Definitivo',  1, '2019-03-01'),
  ('BBB020202BBB', 'COMERCIALIZADORA SIMULADA SC',           'EFOS', 'Definitivo',  2, '2019-03-01'),
  ('CCC030303CCC', 'SERVICIOS FICTICIOS DEL NORTE SA DE CV', 'EFOS', 'Presunto',    3, '2023-06-15'),
  ('DDD040404DDD', 'DISTRIBUIDORA OPACA SAPI DE CV',         'EDOS', 'Definitivo',  4, '2021-09-10'),
  ('EEE050505EEE', 'CONSULTORA IRREAL SC',                   'EFOS', 'Desvirtuado', 5, '2020-12-01')
ON CONFLICT (rfc) DO NOTHING;
