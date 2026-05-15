import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — ContAuditAI',
  description: 'Política de privacidad y tratamiento de datos de ContAuditAI.',
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="ContAuditAI" width={28} height={28} className="rounded-lg" />
          <span className="text-sm font-bold">ContAudit<span className="text-indigo-400">AI</span></span>
        </Link>
        <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors">
          Iniciar sesión
        </Link>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-xs font-semibold text-yellow-400 mb-8">
          🚧 Documento en preparación
        </div>

        <h1 className="text-4xl font-extrabold mb-4">Política de Privacidad</h1>
        <p className="text-gray-400 text-sm mb-12">Última actualización: Mayo 2026</p>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-8 mb-12 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-bold text-white mb-3">Estamos preparando este documento</h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
            Nuestra Política de Privacidad completa está siendo redactada conforme a la{' '}
            <strong className="text-white">Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong>{' '}
            y el estándar GDPR para usuarios internacionales.
          </p>
        </div>

        {/* Anticipos */}
        <div className="flex flex-col gap-5">
          {[
            {
              icon: '🏢',
              title: 'Responsable del tratamiento',
              desc: 'Pronosoft MX, con domicilio en México. Correo de contacto: ventas@pronosoftmx.com',
            },
            {
              icon: '📄',
              title: 'Datos que recopilamos',
              desc: 'Nombre, correo electrónico (Google OAuth), RFC de empresa, XMLs de CFDIs y estados de cuenta que tú subes voluntariamente para el análisis.',
            },
            {
              icon: '🎯',
              title: 'Finalidad del uso',
              desc: 'Los datos se usan exclusivamente para generar el análisis fiscal de tu empresa dentro de la plataforma. No se comparten con terceros ni se usan para publicidad.',
            },
            {
              icon: '🔐',
              title: 'Seguridad',
              desc: 'Datos almacenados en Supabase (infraestructura AWS en región us-east-1) con Row-Level Security (RLS) por tenant. Cada empresa solo accede a sus propios datos.',
            },
            {
              icon: '✋',
              title: 'Tus derechos ARCO',
              desc: 'Tienes derecho de Acceso, Rectificación, Cancelación y Oposición al tratamiento de tus datos. Escríbenos a ventas@pronosoftmx.com.',
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 rounded-xl border border-white/8 bg-white/3 p-5">
              <span className="text-2xl shrink-0">{item.icon}</span>
              <div>
                <h3 className="font-bold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>

      {/* Footer mínimo */}
      <footer className="border-t border-white/8 px-6 py-6 text-center">
        <p className="text-xs text-gray-600">© 2026 ContAuditAI · Pronosoft MX. Todos los derechos reservados.</p>
      </footer>
    </main>
  )
}
