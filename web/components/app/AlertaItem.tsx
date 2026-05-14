'use client'

import { useTransition } from 'react'
import { resolverAlerta } from '@/app/app/alertas/actions'

type Alerta = {
  id: string
  tipo_alerta: string
  severidad: string
  descripcion: string | null
  estado: string
  created_at: string
  uuid_referencia: string | null
}

const TIPO_LABEL: Record<string, string> = {
  EFOS_DETECTADO:          'EFOS Detectado',
  PPD_SIN_CRP:             'PPD sin CRP',
  DISCREPANCIA_BANCARIA:   'Discrepancia Bancaria',
  CANCELACION_RETROACTIVA: 'Cancelación Retroactiva',
  MATERIALIDAD_FALTANTE:   'Materialidad Faltante',
  VENTANA_72H:             'Ventana 72h',
}

const SEV_STYLE: Record<string, string> = {
  CRITICA: 'border-red-500/40 bg-red-500/10',
  MEDIA:   'border-yellow-500/40 bg-yellow-500/10',
  BAJA:    'border-blue-500/40 bg-blue-500/10',
}

const SEV_BADGE: Record<string, string> = {
  CRITICA: 'bg-red-500/20 text-red-400',
  MEDIA:   'bg-yellow-500/20 text-yellow-400',
  BAJA:    'bg-blue-500/20 text-blue-400',
}

export default function AlertaItem({ alerta }: { alerta: Alerta }) {
  const [pending, start] = useTransition()

  function accion(estado: 'Resuelto' | 'Ignorado') {
    start(() => resolverAlerta(alerta.id, estado))
  }

  const pendiente = alerta.estado === 'Pendiente'

  return (
    <div className={`rounded-xl border px-4 py-4 flex gap-4 items-start transition-opacity ${
      SEV_STYLE[alerta.severidad] ?? 'border-white/10 bg-white/5'
    } ${pending ? 'opacity-50' : ''}`}>
      {/* Badges */}
      <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${SEV_BADGE[alerta.severidad]}`}>
          {alerta.severidad}
        </span>
        {alerta.estado !== 'Pendiente' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 text-center">
            {alerta.estado}
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm font-semibold text-white">
          {TIPO_LABEL[alerta.tipo_alerta] ?? alerta.tipo_alerta}
        </p>
        <p className="text-xs text-gray-300">{alerta.descripcion}</p>
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          {alerta.uuid_referencia && (
            <span className="font-mono">{alerta.uuid_referencia.slice(0, 8).toUpperCase()}</span>
          )}
          <span>{new Date(alerta.created_at).toLocaleDateString('es-MX')}</span>
        </div>
      </div>

      {/* Acciones */}
      {pendiente && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accion('Resuelto')}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400
                       hover:bg-green-600/40 transition-colors disabled:opacity-50"
          >
            Resuelto
          </button>
          <button
            onClick={() => accion('Ignorado')}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-600/20 text-gray-400
                       hover:bg-gray-600/40 transition-colors disabled:opacity-50"
          >
            Ignorar
          </button>
        </div>
      )}
    </div>
  )
}
