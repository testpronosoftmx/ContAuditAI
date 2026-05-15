import Link from 'next/link'
import Image from 'next/image'

/* ─── Datos de funcionalidades ──────────────────────────────── */
const features = [
  {
    icon: '🎯',
    title: 'Risk Score 0–100',
    desc: 'Medidor de exposición fiscal actualizado con cada análisis. Pondera por criticidad: EFOS vale 10 puntos, alertas medias 2, bajas 0.5.',
  },
  {
    icon: '🔗',
    title: 'Conciliación CFDI ↔ SPEI',
    desc: 'Motor de 3 capas: match por UUID exacto (confianza ALTA), monto+fecha ±45 días (confianza MEDIA), y pago parcial 10–95% (confianza BAJA).',
  },
  {
    icon: '🚫',
    title: 'Alerta EFOS / EDOS',
    desc: 'Cruza todos tus proveedores con la lista Art. 69-B del SAT en cada análisis. Alerta crítica con referencia legal incluida.',
  },
  {
    icon: '📄',
    title: 'Complemento de Pago (CRP)',
    desc: 'Detecta facturas PPD sin Complemento de Recepción de Pago. Sin CRP el IVA no es acreditable — Regla 2.7.1.30 RMF 2026.',
  },
  {
    icon: '⏱️',
    title: 'Ventana 72h SAT',
    desc: 'Detecta CFDIs expedidos más de 72 horas después del cobro. Referencia: Art. 29 CFF y Regla 2.7.1.1 RMF.',
  },
  {
    icon: '🗂️',
    title: 'Evidencias Documentales',
    desc: 'Archiva contratos, bitácoras y entregables por CFDI. Demuestra materialidad ante el SAT para EFOS (Art. 69-B) y operaciones ≥ $20,000 (Art. 49-Bis CFF).',
  },
  {
    icon: '❌',
    title: 'Cancelaciones Retroactivas',
    desc: 'Identifica CFDIs cancelados días después de su emisión ya aplicados como deducción. Alerta con días transcurridos.',
  },
  {
    icon: '📅',
    title: 'Cruce de Mes IVA',
    desc: 'Señala facturas emitidas en un mes pero cobradas en otro. Previene diferencias en tu declaración mensual de IVA.',
  },
  {
    icon: '💸',
    title: 'Ingresos sin Factura',
    desc: 'Detecta depósitos SPEI sin CFDI correspondiente. Todo ingreso debe tener comprobante para ISR e IVA — Art. 17 LISR.',
  },
  {
    icon: '📊',
    title: 'Dashboard con Charts',
    desc: 'Risk Score en gauge, distribución de CFDIs por tipo (I/E/P) y evolución mensual de comprobantes en visualizaciones interactivas.',
  },
]

/* ─── Tipos de alertas ──────────────────────────────────────── */
const alertTypes = [
  { code: 'EFOS_DETECTADO',          label: 'EFOS Detectado',          sev: 'CRITICA', ref: 'Art. 69-B CFF' },
  { code: 'CANCELACION_RETROACTIVA', label: 'Cancelación Retroactiva',  sev: 'CRITICA', ref: 'Art. 29-A CFF' },
  { code: 'PPD_SIN_CRP',             label: 'PPD sin CRP',              sev: 'MEDIA',   ref: 'Regla 2.7.1.30 RMF' },
  { code: 'DISCREPANCIA_BANCARIA',   label: 'Discrepancia Bancaria',    sev: 'MEDIA',   ref: 'Art. 27 LISR' },
  { code: 'VENTANA_72H',             label: 'Ventana 72h SAT',          sev: 'MEDIA',   ref: 'Art. 29 CFF' },
  { code: 'MATERIALIDAD_FALTANTE',   label: 'Materialidad Faltante',    sev: 'MEDIA',   ref: 'Art. 49-Bis CFF' },
  { code: 'INGRESO_NO_FACTURADO',    label: 'Ingreso no Facturado',     sev: 'MEDIA',   ref: 'Art. 17 LISR' },
  { code: 'CONCILIACION_CRUCE_MES',  label: 'Cruce de Mes',             sev: 'BAJA',    ref: 'Art. 11 LIVA' },
  { code: 'FACTURA_VENCIDA',         label: 'Factura Vencida',          sev: 'BAJA',    ref: 'Art. 31 LISR' },
  { code: 'HUERFANO_XML',            label: 'Factura sin Pago',         sev: 'BAJA',    ref: 'Art. 29 CFF' },
]

/* ─── Planes ────────────────────────────────────────────────── */
const planes = [
  {
    id: 'gratis',
    nombre: 'Gratis',
    precio: '$0',
    periodo: 'siempre',
    desc: 'Para el contador independiente que quiere evaluar la plataforma antes de comprometerse.',
    color: 'border-white/10',
    btnClass: 'bg-white/10 hover:bg-white/20 text-white',
    badge: null,
    features: [
      '1 RFC / empresa',
      '100 CFDIs por mes',
      '1 usuario',
      'Risk Score en tiempo real',
      '10 tipos de alertas fiscales',
      'Conciliación CFDI ↔ SPEI',
      'Detección EFOS/EDOS',
      'Dashboard con charts',
      'Evidencias Documentales',
      'Carga masiva de XMLs',
      'Soporte por correo',
    ],
    noFeatures: [
      'Verificación SAT en tiempo real',
    ],
  },
  {
    id: 'plata',
    nombre: 'Plata',
    precio: '$499',
    periodo: 'MXN / mes',
    desc: 'Ideal para despachos contables con 1 a 5 clientes activos y necesidades formales.',
    color: 'border-indigo-500/50',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    badge: '⭐ Más Popular',
    features: [
      '5 RFCs / empresas',
      '500 CFDIs por mes',
      '3 usuarios',
      'Risk Score en tiempo real',
      '10 tipos de alertas fiscales',
      'Conciliación CFDI ↔ SPEI',
      'Detección EFOS/EDOS',
      'Dashboard con charts',
      'Evidencias Documentales (Art. 49-Bis · 69-B)',
      'Carga masiva de XMLs y CSV',
      'Soporte por correo',
    ],
    noFeatures: [
      'Verificación SAT en tiempo real (próximamente)',
    ],
  },
  {
    id: 'oro',
    nombre: 'Oro',
    precio: '$1,299',
    periodo: 'MXN / mes',
    desc: 'Para despachos medianos y CFOs corporativos que gestionan alto volumen con integración total.',
    color: 'border-amber-500/50',
    btnClass: 'bg-amber-500 hover:bg-amber-400 text-black font-bold',
    badge: '🏆 Empresarial',
    features: [
      'RFCs ilimitados',
      'CFDIs ilimitados',
      '10 usuarios',
      'Risk Score en tiempo real',
      '10 tipos de alertas fiscales',
      'Conciliación CFDI ↔ SPEI',
      'Detección EFOS/EDOS',
      'Dashboard con charts',
      'Evidencias Documentales (Art. 49-Bis · 69-B)',
      'Carga masiva de XMLs y CSV',
      'Soporte prioritario',
      'Verificación de estatus SAT (próximamente)',
    ],
    noFeatures: [],
  },
]

/* ─── Cómo funciona ─────────────────────────────────────────── */
const steps = [
  { n: '01', title: 'Sube tus XMLs y CSV bancario', desc: 'Carga masiva de CFDIs descargados del SAT y tu estado de cuenta en formato CSV del banco.' },
  { n: '02', title: 'El motor analiza en segundos', desc: 'El engine SQL cruza proveedores con EFOS, valida PPD/CRP, detecta cancelaciones y concilia depósitos SPEI.' },
  { n: '03', title: 'Recibe alertas con contexto legal', desc: 'Cada alerta incluye: descripción del riesgo, acción recomendada y referencia al artículo aplicable del CFF/LISR/LIVA.' },
  { n: '04', title: 'Resuelve o documenta evidencia', desc: 'Marca alertas como Resuelto o adjunta evidencia en el Expediente de Evidencias. El Risk Score se actualiza automáticamente.' },
]

/* ─── Componentes internos ──────────────────────────────────── */
function SevBadge({ sev }: { sev: string }) {
  const cls =
    sev === 'CRITICA' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    sev === 'MEDIA'   ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wider ${cls}`}>
      {sev}
    </span>
  )
}

/* ─── PAGE ──────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="ContAuditAI" width={32} height={32} className="rounded-lg" />
          <span className="text-base font-bold tracking-tight">ContAudit<span className="text-indigo-400">AI</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <a href="#pricing" className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors">Precios</a>
          <a href="#features" className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors">Funcionalidades</a>
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 gap-7 overflow-hidden">
        {/* Glow bg */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <span className="relative rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-widest">
          Pre-Auditoría SAT · CFDI 4.0 · México 2026
        </span>

        <h1 className="relative max-w-4xl text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Anticipa al SAT<br className="hidden sm:block" />{' '}
          antes de que{' '}
          <span className="text-indigo-400">te llame</span>
        </h1>

        <p className="relative max-w-2xl text-lg text-gray-400 leading-relaxed">
          ContAuditAI cruza tus <strong className="text-white">CFDIs</strong>, depósitos <strong className="text-white">SPEI</strong> y la lista <strong className="text-white">EFOS/EDOS</strong> del SAT en segundos. Recibe un <strong className="text-indigo-300">Risk Score fiscal 0–100</strong> y alertas accionables con su referencia legal exacta — antes de cualquier revisión.
        </p>

        <div className="relative flex flex-col sm:flex-row gap-4 mt-2">
          <Link
            href="/app/dashboard"
            className="rounded-xl bg-indigo-600 px-8 py-3.5 font-bold text-base hover:bg-indigo-500 transition-all hover:scale-105 shadow-lg shadow-indigo-600/25"
          >
            Ir al dashboard →
          </Link>
          <a
            href="#pricing"
            className="rounded-xl border border-white/20 px-8 py-3.5 font-semibold text-base hover:bg-white/5 transition-colors"
          >
            Ver planes
          </a>
        </div>

        {/* Stats row */}
        <div className="relative flex flex-wrap justify-center gap-8 mt-8 border-t border-white/5 pt-8 w-full max-w-2xl">
          {[
            { val: '10', label: 'Tipos de alertas fiscales' },
            { val: '3', label: 'Niveles de match bancario' },
            { val: '0–100', label: 'Risk Score en tiempo real' },
            { val: 'Art. 69-B', label: 'Cobertura EFOS / EDOS' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-indigo-400">{s.val}</span>
              <span className="text-xs text-gray-500 text-center max-w-[100px]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-center text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Proceso</p>
        <h2 className="text-center text-3xl font-extrabold mb-14">¿Cómo funciona ContAuditAI?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-white/8 bg-white/3 p-6 flex flex-col gap-3 hover:border-indigo-500/30 transition-colors">
              <span className="text-4xl font-black text-indigo-500/30">{s.n}</span>
              <h3 className="font-bold text-white text-sm">{s.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="features" className="bg-white/2 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-center text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Motor Fiscal</p>
          <h2 className="text-center text-3xl font-extrabold mb-3">Funcionalidades completas</h2>
          <p className="text-center text-gray-400 text-sm max-w-xl mx-auto mb-14">
            Cada módulo fue diseñado con base en las reglas del CFF, LISR, LIVA y la Resolución Miscelánea Fiscal 2026.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/8 bg-gray-900/60 p-5 flex flex-col gap-3 hover:border-indigo-500/40 transition-all hover:bg-gray-900/80 group">
                <span className="text-2xl group-hover:scale-110 transition-transform inline-block">{f.icon}</span>
                <h3 className="font-bold text-sm text-white">{f.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10 TIPOS DE ALERTAS ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-center text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Alertas Fiscales</p>
        <h2 className="text-center text-3xl font-extrabold mb-3">10 tipos de riesgo detectados</h2>
        <p className="text-center text-gray-400 text-sm max-w-lg mx-auto mb-12">
          Cada alerta incluye la referencia legal aplicable, una explicación en lenguaje contable y la acción recomendada.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {alertTypes.map((a) => (
            <div key={a.code} className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-gray-900/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <SevBadge sev={a.sev} />
                <span className="text-sm font-semibold text-white">{a.label}</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 shrink-0">{a.ref}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="bg-white/2 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-center text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Planes y Precios</p>
          <h2 className="text-center text-3xl font-extrabold mb-3">Elige tu plan</h2>
          <p className="text-center text-gray-400 text-sm max-w-xl mx-auto mb-14">
            Sin contratos anuales forzosos. Cancela en cualquier momento. Todos los planes incluyen el motor de análisis completo.
          </p>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {planes.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl border ${p.color} bg-gray-900 p-7 flex flex-col gap-5 ${p.id === 'plata' ? 'ring-2 ring-indigo-500/40 shadow-2xl shadow-indigo-500/10' : ''}`}
              >
                {p.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-[11px] font-bold text-white whitespace-nowrap shadow-lg">
                    {p.badge}
                  </span>
                )}

                <div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{p.nombre}</p>
                  <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-black text-white">{p.precio}</span>
                    <span className="text-sm text-gray-400 mb-1">{p.periodo}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 leading-relaxed">{p.desc}</p>
                </div>

                <Link href={p.id === 'gratis' ? '/app/dashboard' : '/login'}
                  className={`w-full text-center rounded-xl py-3 text-sm font-semibold transition-all ${p.btnClass}`}
                >
                  {p.id === 'gratis' ? 'Comenzar gratis →' : `Activar plan ${p.nombre} →`}
                </Link>

                <div className="flex flex-col gap-2.5 border-t border-white/8 pt-4">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-xs text-gray-300">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </div>
                  ))}
                  {p.noFeatures.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-xs text-gray-600">
                      <span className="mt-0.5 shrink-0">✕</span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-600 mt-8">
            Precios más IVA. Facturación mensual. Pago con tarjeta de crédito o débito.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center flex flex-col items-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-2">
          <Image src="/logo.png" alt="ContAuditAI" width={40} height={40} className="rounded-xl" />
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
          Tu primera pre-auditoría,<br />
          <span className="text-indigo-400">completamente gratis</span>
        </h2>
        <p className="text-gray-400 max-w-lg leading-relaxed">
          Sube tus CFDIs y tu estado de cuenta hoy. En segundos sabrás cuál es tu riesgo fiscal real ante el SAT — sin pagar nada.
        </p>
        <Link
          href="/app/dashboard"
          className="rounded-xl bg-indigo-600 px-10 py-4 font-bold text-base hover:bg-indigo-500 transition-all hover:scale-105 shadow-xl shadow-indigo-600/30"
        >
          Comenzar ahora — es gratis →
        </Link>
        <p className="text-xs text-gray-600">Sin tarjeta de crédito · Sin instalación · Datos procesados en México</p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/8 px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
          <div className="flex flex-col gap-3 max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="ContAuditAI" width={24} height={24} className="rounded" />
              <span className="text-sm font-bold">ContAudit<span className="text-indigo-400">AI</span></span>
            </Link>
            <p className="text-xs text-gray-500 leading-relaxed">
              Motor de pre-auditoría fiscal mexicana. Cruza CFDIs, SPEI y listas EFOS/EDOS con inteligencia artificial.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Producto</p>
              <Link href="/app/dashboard" className="text-gray-500 hover:text-white transition-colors">Dashboard</Link>
              <a href="#features" className="text-gray-500 hover:text-white transition-colors">Funcionalidades</a>
              <a href="#pricing" className="text-gray-500 hover:text-white transition-colors">Precios</a>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Legal</p>
              <Link href="/privacidad" className="text-gray-500 hover:text-white transition-colors text-xs">Privacidad</Link>
              <Link href="/terminos" className="text-gray-500 hover:text-white transition-colors text-xs">Términos de Servicio</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contacto</p>
              <a href="mailto:ventas@pronosoftmx.com" className="text-gray-500 hover:text-white transition-colors text-xs">
                ventas@pronosoftmx.com
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between gap-2">
          <p className="text-xs text-gray-600">© 2026 ContAuditAI · Pronosoft MX. Todos los derechos reservados.</p>
          <p className="text-xs text-gray-600">Hecho en México 🇲🇽 · CFDI 4.0 · SAT 2026</p>
        </div>
      </footer>

    </main>
  )
}
