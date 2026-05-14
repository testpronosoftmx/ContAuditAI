import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">ContAuditAI</span>
        <Link
          href="/login"
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
        >
          Iniciar sesión
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-32 gap-6">
        <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1 text-xs font-medium text-indigo-300 uppercase tracking-widest">
          Pre-Auditoría SAT · México 2026
        </span>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-tight tracking-tight">
          Anticipa al SAT antes de que{' '}
          <span className="text-indigo-400">te llame</span>
        </h1>
        <p className="max-w-xl text-lg text-gray-400 leading-relaxed">
          ContAuditAI cruza tus CFDIs, SPEI y lista EFOS/EDOS en tiempo real
          para darte un Risk Score fiscal y alertas accionables antes de
          cualquier revisión.
        </p>
        <div className="flex gap-4 mt-4">
          <Link
            href="/app/dashboard"
            className="rounded-lg bg-indigo-600 px-7 py-3 font-semibold hover:bg-indigo-500 transition-colors"
          >
            Ir al dashboard
          </Link>
          <a
            href="#features"
            className="rounded-lg border border-white/20 px-7 py-3 font-semibold hover:bg-white/5 transition-colors"
          >
            Ver funcionalidades
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-32 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: '⚡', title: 'Risk Score en tiempo real', desc: 'Medidor 0–100 de exposición ante el SAT actualizado con cada CFDI.' },
          { icon: '🔗', title: 'Conciliación SPEI ↔ CFDI', desc: 'Detecta depósitos PPD sin Complemento de Pago y discrepancias bancarias.' },
          { icon: '🚫', title: 'Alerta EFOS/EDOS', desc: 'Cruza tus proveedores con la lista negra del SAT al instante.' },
          { icon: '📁', title: 'Vault de Materialidad', desc: 'Guarda contratos y evidencia con hash SHA-256 conforme al Art. 49-Bis.' },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-3">
            <span className="text-3xl">{f.icon}</span>
            <h3 className="font-semibold text-white">{f.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
