import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Bienvenido, {user?.email}</p>
      </div>

      {/* Risk Score */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Risk Score', value: '—', sub: 'Sube tus CFDIs para calcular', color: 'text-indigo-400' },
          { label: 'CFDIs este mes', value: '0', sub: 'Facturas procesadas', color: 'text-white' },
          { label: 'PPD sin CRP', value: '0', sub: 'Complementos pendientes', color: 'text-yellow-400' },
          { label: 'Alertas críticas', value: '0', sub: 'Requieren acción inmediata', color: 'text-red-400' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-500">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Placeholder alertas */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-3">
        <h2 className="font-semibold">Alertas recientes</h2>
        <p className="text-sm text-gray-500">
          No hay alertas. Importa tus CFDIs y estados de cuenta para comenzar el análisis.
        </p>
      </div>
    </div>
  )
}
