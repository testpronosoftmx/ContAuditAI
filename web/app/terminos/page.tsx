import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos de Servicio — ContAuditAI',
  description: 'Términos y condiciones de uso de la plataforma ContAuditAI.',
}

export default function TerminosPage() {
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

        <h1 className="text-4xl font-extrabold mb-4">Términos de Servicio</h1>
        <p className="text-gray-400 text-sm mb-12">Última actualización: Mayo 2026</p>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-8 mb-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-xl font-bold text-white mb-3">Estamos preparando este documento</h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
            Nuestros Términos de Servicio completos están siendo redactados. A continuación encontrarás los principios
            clave que rigen el uso de ContAuditAI mientras publicamos la versión definitiva.
          </p>
        </div>

        {/* Principios anticipados */}
        <div className="flex flex-col gap-5">
          {[
            {
              icon: '🎯',
              title: 'Propósito del servicio',
              desc: 'ContAuditAI es una plataforma de pre-auditoría fiscal para personas morales y físicas con actividad empresarial en México. No sustituye la asesoría de un contador certificado ni la obligación legal de cumplimiento ante el SAT.',
            },
            {
              icon: '💳',
              title: 'Planes y facturación',
              desc: 'Los planes Plata ($499 MXN/mes) y Oro ($1,299 MXN/mes) se cobran mensualmente. Puedes cancelar en cualquier momento desde tu panel. Los precios no incluyen IVA. No realizamos reembolsos por periodos ya facturados.',
            },
            {
              icon: '📂',
              title: 'Propiedad de tus datos',
              desc: 'Los CFDIs, estados de cuenta y documentos que subes son tuyos. ContAuditAI no los vende ni comparte. Puedes solicitar la eliminación completa de tu cuenta y datos en cualquier momento.',
            },
            {
              icon: '⚠️',
              title: 'Límites de responsabilidad',
              desc: 'Los análisis de ContAuditAI son informativos. La plataforma detecta riesgos potenciales basándose en los datos que el usuario carga — no accede directamente al SAT ni garantiza la exactitud de datos incompletos o incorrectos.',
            },
            {
              icon: '🔄',
              title: 'Cambios en el servicio',
              desc: 'Podemos actualizar funcionalidades, precios o estos términos con al menos 30 días de aviso previo por correo electrónico a los usuarios con plan activo.',
            },
            {
              icon: '⚖️',
              title: 'Legislación aplicable',
              desc: 'Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se someterá a los tribunales competentes de la Ciudad de México.',
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

        <div className="mt-12 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-sm text-gray-400 leading-relaxed">
          <strong className="text-indigo-300">¿Tienes preguntas?</strong> Escríbenos a{' '}
          <a href="mailto:ventas@pronosoftmx.com" className="text-indigo-400 hover:text-indigo-300 underline transition-colors">
            ventas@pronosoftmx.com
          </a>{' '}
          y te respondemos en menos de 24 horas en días hábiles.
        </div>

        <div className="mt-10 text-center">
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
