#!/usr/bin/env node
/**
 * Genera 100 XMLs CFDI 4.0 de demostración para ContAuditAI
 * Preserva los 3 XMLs EFOS ya existentes (AAA010101AAA, CCC030303CCC, DDD040404DDD)
 * Total resultante: 103 XMLs
 *
 * Escenarios generados:
 *   F1-F60   → PUE, pagado, monto coincide con banco exactamente
 *   F61-F70  → PUE, pagado, monto con discrepancia ~5% vs banco
 *   F71-F90  → PPD sin CRP, 15 de ellos tienen SPEI en banco (REF81-REF95)
 *   F91-F100 → PPD sin CRP, sin ningún movimiento bancario (no pagados)
 *   5 SPEI huérfanos → REF96-REF100 en banco sin XML correspondiente
 */

const fs   = require('fs')
const path = require('path')

const DEMO_DIR     = path.resolve(__dirname, '..', 'docsdemo')
const RFC_EMISOR   = 'DEMO123456XYZ'
const NOM_EMISOR   = 'EMPRESA DEMO SA DE CV'
const REGIMEN      = '601'
const LUG_EXPEDICION = '10000'

const CLIENTES = [
  { rfc: 'REC966252ABC', nombre: 'CLIENTE MAYORISTA SA DE CV',         cp: '20000' },
  { rfc: 'REC966252DEF', nombre: 'DISTRIBUIDORA NORTE SA DE CV',       cp: '32000' },
  { rfc: 'REC966252GHI', nombre: 'SERVICIOS INTEGRALES SA DE CV',      cp: '44000' },
  { rfc: 'REC966252JKL', nombre: 'GRUPO COMERCIAL DEL SUR SA DE CV',   cp: '06000' },
  { rfc: 'REC966252MNO', nombre: 'TECNOLOGIAS AVANZADAS SA DE CV',     cp: '11000' },
]

const CONCEPTOS = [
  { clave: '84111506', unidad: 'E48', desc: 'Servicios de consultoria empresarial' },
  { clave: '80141600', unidad: 'E48', desc: 'Servicios de administracion' },
  { clave: '81112100', unidad: 'E48', desc: 'Desarrollo de software a medida' },
  { clave: '84121806', unidad: 'E48', desc: 'Servicios de contabilidad' },
  { clave: '78181801', unidad: 'E48', desc: 'Servicios de logistica y distribucion' },
]

// ── 1. Borrar XMLs anteriores de DEMO123456XYZ ───────────────────────────
const viejos = fs.readdirSync(DEMO_DIR)
  .filter(f => f.startsWith(RFC_EMISOR) && f.endsWith('.xml'))
console.log(`Borrando ${viejos.length} XMLs anteriores de ${RFC_EMISOR}...`)
for (const f of viejos) fs.unlinkSync(path.join(DEMO_DIR, f))

// ── 2. Leer CSV y mapear montos ───────────────────────────────────────────
const csvLines = fs.readFileSync(path.join(DEMO_DIR, 'estado_cuenta.csv'), 'utf8')
  .trim().split('\n').slice(1)  // omitir header

const pagosPorFolio = {}  // { 'F1': 43777.66, ... }
const speiMontos    = []  // montos de TRANSFERENCIA SPEI en orden

for (const linea of csvLines) {
  const [, concepto, , cargoStr, abonoStr] = linea.split(',')
  const abono = parseFloat(abonoStr) || 0
  const m = concepto && concepto.match(/^PAGO FACTURA (F\d+)$/)
  if (m) pagosPorFolio[m[1]] = abono
  if (concepto === 'TRANSFERENCIA SPEI') speiMontos.push(abono)
}

// ── 3. Helpers ────────────────────────────────────────────────────────────
function uuid(n) {
  const pad = (v, l) => v.toString(16).toUpperCase().padStart(l, '0')
  const a = pad(n * 0xA3 + 0x1000, 8)
  const b = pad(n * 0x7F + 0x2000, 4)
  const c = pad(n * 0x5B + 0x3000, 4)
  const d = pad(n * 0x3D + 0x4000, 4)
  const e = pad(n * 0x2F + 0x500000, 12)
  return `${a.slice(0,8)}-${b}-4${c.slice(1,4)}-${d}-${e.slice(0,12)}`
}

function round2(v) { return Math.round(v * 100) / 100 }

function calcIVA(total) {
  const sub = round2(total / 1.16)
  const iva = round2(sub * 0.16)
  return { sub, iva, total: round2(sub + iva) }
}

function fechaXML(base, offsetDias = 0) {
  const d = new Date(base)
  d.setDate(d.getDate() + offsetDias)
  return d.toISOString().slice(0, 10) + 'T' + ['08','09','10','11','12','13','14','15','16'][offsetDias % 9] + ':00:00'
}

function clientePara(folio) { return CLIENTES[(folio - 1) % CLIENTES.length] }
function conceptoPara(folio) { return CONCEPTOS[(folio - 1) % CONCEPTOS.length] }

function xml({ folio, uuid: uuidVal, fecha, metodo, sub, iva, total, receptor, concepto, serie = 'F' }) {
  return `<?xml version='1.0' encoding='utf-8'?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="${serie}" Folio="${folio}" Fecha="${fecha}" Total="${total}" SubTotal="${sub}" Moneda="MXN" TipoDeComprobante="I" MetodoPago="${metodo}" FormaPago="03" LugarExpedicion="${LUG_EXPEDICION}">
\t<cfdi:Emisor Rfc="${RFC_EMISOR}" Nombre="${NOM_EMISOR}" RegimenFiscal="${REGIMEN}" />
\t<cfdi:Receptor Rfc="${receptor.rfc}" Nombre="${receptor.nombre}" UsoCFDI="G03" RegimenFiscalReceptor="${REGIMEN}" DomicilioFiscalReceptor="${receptor.cp}" />
\t<cfdi:Conceptos>
\t\t<cfdi:Concepto ClaveProdServ="${concepto.clave}" Cantidad="1" ClaveUnidad="${concepto.unidad}" Descripcion="${concepto.desc}" ValorUnitario="${sub}" Importe="${sub}" ObjetoImp="02" />
\t</cfdi:Conceptos>
\t<cfdi:Impuestos TotalImpuestosTrasladados="${iva}">
\t\t<cfdi:Traslados>
\t\t\t<cfdi:Traslado Base="${sub}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva}" />
\t\t</cfdi:Traslados>
\t</cfdi:Impuestos>
\t<cfdi:Complemento>
\t\t<tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="${uuidVal}" />
\t</cfdi:Complemento>
</cfdi:Comprobante>`
}

function escribir(serie, folio, contenido) {
  const uuidShort = contenido.match(/UUID="([^"]+)"/)[1].slice(0, 8)
  const nombre = `${RFC_EMISOR}_${serie}${folio}_${uuidShort}.xml`
  fs.writeFileSync(path.join(DEMO_DIR, nombre), contenido, 'utf8')
  return nombre
}

// ── 4. Generar XMLs ───────────────────────────────────────────────────────
let generados = 0
const BASE = '2026-05-01'

// F1-F60: PUE pagado, monto exacto del banco
for (let f = 1; f <= 60; f++) {
  const bancoTotal = pagosPorFolio[`F${f}`]
  if (!bancoTotal) { console.warn(`  ⚠  Sin entrada CSV para F${f}`) ; continue }
  const { sub, iva, total } = calcIVA(bancoTotal)
  const rec = clientePara(f)
  const con = conceptoPara(f)
  const fechaStr = fechaXML(BASE, (f - 1) % 28)
  const u = uuid(f)
  const contenido = xml({ folio: f, uuid: u, fecha: fechaStr, metodo: 'PUE', sub, iva, total, receptor: rec, concepto: con })
  const archivo = escribir('F', f, contenido)
  console.log(`  ✓ F${f}  PUE-match   ${archivo}`)
  generados++
}

// F61-F70: PUE pagado, discrepancia ~5% en monto (XML tiene más que banco)
for (let f = 61; f <= 70; f++) {
  const bancoTotal = pagosPorFolio[`F${f}`]
  if (!bancoTotal) { console.warn(`  ⚠  Sin entrada CSV para F${f}`) ; continue }
  const totalXML = round2(bancoTotal * 1.05)   // 5% más que banco → discrepancia
  const { sub, iva, total } = calcIVA(totalXML)
  const rec = clientePara(f)
  const con = conceptoPara(f)
  const fechaStr = fechaXML(BASE, (f - 1) % 28)
  const u = uuid(f)
  const contenido = xml({ folio: f, uuid: u, fecha: fechaStr, metodo: 'PUE', sub, iva, total, receptor: rec, concepto: con })
  const archivo = escribir('F', f, contenido)
  console.log(`  ✓ F${f}  PUE-discr   ${archivo}  (banco: ${bancoTotal}, XML: ${total})`)
  generados++
}

// F71-F85: PPD sin CRP, con SPEI en banco (REF81-REF95 → speiMontos[0..14])
for (let f = 71; f <= 85; f++) {
  const idx = f - 71          // 0..14 → primeros 15 SPEI
  const bancoTotal = speiMontos[idx] || round2(10000 + f * 317.5)
  const { sub, iva, total } = calcIVA(bancoTotal)
  const rec = clientePara(f)
  const con = conceptoPara(f)
  const fechaStr = fechaXML(BASE, (f - 71) % 28)
  const u = uuid(f)
  const contenido = xml({ folio: f, uuid: u, fecha: fechaStr, metodo: 'PPD', sub, iva, total, receptor: rec, concepto: con })
  const archivo = escribir('F', f, contenido)
  console.log(`  ✓ F${f}  PPD-sinCRP  ${archivo}  (SPEI en banco: ${bancoTotal})`)
  generados++
}

// F86-F90: PPD sin CRP, sin movimiento bancario (huérfanos de XML)
for (let f = 86; f <= 90; f++) {
  const totalXML = round2(8000 + f * 421.3)
  const { sub, iva, total } = calcIVA(totalXML)
  const rec = clientePara(f)
  const con = conceptoPara(f)
  const fechaStr = fechaXML(BASE, (f - 86) % 20)
  const u = uuid(f)
  const contenido = xml({ folio: f, uuid: u, fecha: fechaStr, metodo: 'PPD', sub, iva, total, receptor: rec, concepto: con })
  const archivo = escribir('F', f, contenido)
  console.log(`  ✓ F${f}  PPD-sinCRP  ${archivo}  (sin banco)`)
  generados++
}

// F91-F100: PPD sin CRP, sin banco (no pagados)
for (let f = 91; f <= 100; f++) {
  const totalXML = round2(5000 + f * 593.7)
  const { sub, iva, total } = calcIVA(totalXML)
  const rec = clientePara(f)
  const con = conceptoPara(f)
  const fechaStr = fechaXML(BASE, (f - 91) % 20)
  const u = uuid(f)
  const contenido = xml({ folio: f, uuid: u, fecha: fechaStr, metodo: 'PPD', sub, iva, total, receptor: rec, concepto: con })
  const archivo = escribir('F', f, contenido)
  console.log(`  ✓ F${f}  PPD-noPago  ${archivo}`)
  generados++
}

// ── 5. Resumen ────────────────────────────────────────────────────────────
const efos = fs.readdirSync(DEMO_DIR).filter(f => f.endsWith('.xml') && !f.startsWith(RFC_EMISOR))
const total = fs.readdirSync(DEMO_DIR).filter(f => f.endsWith('.xml')).length

console.log(`
────────────────────────────────────────────
  XMLs generados hoy   : ${generados}
  XMLs EFOS preservados: ${efos.length}
  Total XMLs en carpeta: ${total}
────────────────────────────────────────────
Escenarios de alerta en demo:
  PPD_SIN_CRP            → F71-F90 (20 facturas PPD sin Complemento de Pago)
  DISCREPANCIA_BANCARIA  → F61-F70 (XML 5% mayor que pago en banco)
                         → REF96-REF100 (5 SPEI en banco sin CFDI)
  CFDI_SIN_PAGO          → F86-F100 (15 facturas PPD sin movimiento bancario)
  EFOS_DETECTADO         → AAA010101AAA, CCC030303CCC, DDD040404DDD
────────────────────────────────────────────`)
