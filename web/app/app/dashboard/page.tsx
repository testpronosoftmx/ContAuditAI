import { createClient } from '@/lib/supabase/server'
import AnalisisBtn from '@/components/app/AnalisisBtn'

export const dynamic = 'force-dynamic'

const SEVERIDAD_COLOR: Record<string, string> = {
  CRITICA: 'bg-red-500/20 text-red-400 border-red-500/30',
  MEDIA:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  BAJA:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const TIPO_LABEL: Record<string, string> = {
  EFOS_DETECTADO:       'EFOS Detectado',
  PPD_SIN_CRP:          'PPD sin CRP',
  DISCREPANCIA_BANCARIA:'Discrepancia Bancaria',
  CANCELACION_RETROACTIVA: 'Cancelación Retroactiva',
  MATERIALIDAD_FALTANTE:'Materialidad Faltante',
  VENTANA_72H:          'Ventana 72h',
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Riesgo bajo'
  if (score >= 50) return 'Riesgo medio'
  return 'Riesgo alto'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: riskData }, { data: alertas }, { count: cfdisCount }, { count: txCount }] =
    await Promise.all([
      supabase
        .from('risk_scores')
        .select('score, factores, periodo')
        .order('periodo', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('alertas_riesgo')
        .select('id, tipo_alerta, severidad, descripcion, created_at')
        .eq('estado', 'Pendiente')
        .order('severidad', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('cfdi_comprobantes').select('*', { count: 'exact', head: true }),
      supabase.from('transacciones_bancarias').select('*', { count: 'exact', head: true }),
    ])

  const score    = riskData?.score ?? null
  const criticas = alertas?.filter(a => a.severidad === 'CRITICA').length ?? 0
  const medias   = alertas?.filter(a => a.severidad === 'MEDIA').length ?? 0

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">{user?.email}</p>
        </div>
        <AnalisisBtn />
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Risk Score</p>
          <p className={`text-3xl font-bold ${score !== null ? scoreColor(score) : 'text-gray-500'}`}>
            {score !== null ? Math.round(score) : '—'}
          </p>
          <p className="text-xs text-gray-500">
            {score !== null ? scoreLabel(score) : 'Ejecuta el análisis'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">CFDIs</p>
          <p className="text-3xl font-bold text-white">{cfdisCount ?? 0}</p>
          <p className="text-xs text-gray-500">Comprobantes cargados</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Alertas críticas</p>
          <p className={`text-3xl font-bold ${criticas > 0 ? 'text-red-400' : 'text-white'}`}>{criticas}</p>
          <p className="text-xs text-gray-500">Requieren acción inmediata</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Alertas medias</p>
          <p className={`text-3xl font-bold ${medias > 0 ? 'text-yellow-400' : 'text-white'}`}>{medias}</p>
          <p className="text-xs text-gray-500">Revisar a la brevedad</p>
        </div>
      </div>

      {/* Alertas */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
        <h2 className="font-semibold">
          Alertas pendientes
          {(alertas?.length ?? 0) > 0 && (
            <span className="ml-2 text-xs text-gray-400 font-normal">{alertas!.length} total</span>
          )}
        </h2>

        {(alertas?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">
            {score === null
              ? 'Importa tus CFDIs y estados de cuenta, luego ejecuta el análisis.'
              : 'Sin alertas pendientes. ¡Excelente postura fiscal!'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {alertas!.map(a => (
              <div key={a.id} className={`rounded-xl border px-4 py-3 flex gap-3 items-start ${SEVERIDAD_COLOR[a.severidad]}`}>
                <span className="text-xs font-bold mt-0.5 shrink-0 uppercase tracking-wide">
                  {a.severidad}
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-semibold">{TIPO_LABEL[a.tipo_alerta] ?? a.tipo_alerta}</span>
                  <span className="text-xs opacity-80 truncate">{a.descripcion}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
