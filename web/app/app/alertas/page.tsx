import { createClient } from '@/lib/supabase/server'
import AlertaItem from '@/components/app/AlertaItem'
import { getPlan, PLANES } from '@/lib/plans'

export const dynamic = 'force-dynamic'

type Filtro = 'todas' | 'criticas' | 'medias' | 'bajas' | 'discrepancias' | 'resueltas'

const TABS: { key: Filtro; label: string }[] = [
  { key: 'todas',         label: 'Pendientes'   },
  { key: 'criticas',      label: 'Críticas'     },
  { key: 'medias',        label: 'Medias'       },
  { key: 'bajas',         label: 'Bajas'        },
  { key: 'discrepancias', label: 'En revisión'  },
  { key: 'resueltas',     label: 'Resueltas'    },
]

const SEV_ORDER: Record<string, number> = { CRITICA: 0, MEDIA: 1, BAJA: 2 }

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>
}) {
  const { f } = await searchParams
  const filtro = (f ?? 'todas') as Filtro

  const supabase = await createClient()

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenants(plan)')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()
  const plan = getPlan((tenantUser?.tenants as { plan?: string } | null)?.plan ?? 'gratis')
  const puedeExportar = PLANES[plan].reportes

  let query = supabase
    .from('alertas_riesgo')
    .select('id, tipo_alerta, severidad, descripcion, estado, created_at, uuid_referencia')
    .order('created_at', { ascending: false })

  if (filtro === 'resueltas') {
    query = query.in('estado', ['Resuelto', 'Ignorado'])
  } else if (filtro === 'criticas') {
    query = query.eq('estado', 'Pendiente').eq('severidad', 'CRITICA')
  } else if (filtro === 'medias') {
    query = query.eq('estado', 'Pendiente').eq('severidad', 'MEDIA')
  } else if (filtro === 'bajas') {
    query = query.eq('estado', 'Pendiente').eq('severidad', 'BAJA')
  } else if (filtro === 'discrepancias') {
    query = query.eq('estado', 'Pendiente').eq('tipo_alerta', 'DISCREPANCIA_BANCARIA')
  } else {
    query = query.eq('estado', 'Pendiente')
  }

  const { data: raw } = await query.limit(200)

  // Pendientes: ordenar CRITICA → MEDIA → BAJA
  const alertas = filtro === 'todas'
    ? [...(raw ?? [])].sort((a, b) => (SEV_ORDER[a.severidad] ?? 9) - (SEV_ORDER[b.severidad] ?? 9))
    : (raw ?? [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-sm text-gray-400 mt-1">Gestiona las alertas de riesgo fiscal de tu empresa</p>
        </div>
        {puedeExportar ? (
          <a
            href="/api/export/alertas"
            className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-300
                       hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
          >
            ↓ Exportar Excel
          </a>
        ) : (
          <span className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-600 cursor-not-allowed">
            ↓ Exportar (Plata+)
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(tab => (
          <a
            key={tab.key}
            href={`/app/alertas?f=${tab.key}`}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              filtro === tab.key
                ? 'bg-white/10 text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {(alertas?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No hay alertas en esta categoría.
          </p>
        ) : (
          alertas!.map(a => <AlertaItem key={a.id} alerta={a} />)
        )}
      </div>
    </div>
  )
}
