import { createClient } from '@/lib/supabase/server'
import AlertaItem from '@/components/app/AlertaItem'

export const dynamic = 'force-dynamic'

type Filtro = 'todas' | 'criticas' | 'medias' | 'resueltas'

const TABS: { key: Filtro; label: string }[] = [
  { key: 'todas',     label: 'Pendientes' },
  { key: 'criticas',  label: 'Críticas'   },
  { key: 'medias',    label: 'Medias'     },
  { key: 'resueltas', label: 'Resueltas'  },
]

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>
}) {
  const { f } = await searchParams
  const filtro = (f ?? 'todas') as Filtro

  const supabase = await createClient()

  let query = supabase
    .from('alertas_riesgo')
    .select('id, tipo_alerta, severidad, descripcion, estado, created_at, uuid_referencia')
    .order('severidad', { ascending: true })
    .order('created_at', { ascending: false })

  if (filtro === 'resueltas') {
    query = query.in('estado', ['Resuelto', 'Ignorado'])
  } else if (filtro === 'criticas') {
    query = query.eq('estado', 'Pendiente').eq('severidad', 'CRITICA')
  } else if (filtro === 'medias') {
    query = query.eq('estado', 'Pendiente').eq('severidad', 'MEDIA')
  } else {
    query = query.eq('estado', 'Pendiente')
  }

  const { data: alertas } = await query.limit(200)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Alertas</h1>
        <p className="text-sm text-gray-400 mt-1">Gestiona las alertas de riesgo fiscal de tu empresa</p>
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
