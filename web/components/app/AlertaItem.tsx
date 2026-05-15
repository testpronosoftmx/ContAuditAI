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
  INGRESO_NO_FACTURADO:    'Ingreso no Facturado',
  CONCILIACION_OK:         'Conciliación OK',
  CONCILIACION_GLOBAL:     'Conciliación Global',
  CONCILIACION_CRUCE_MES:  'Cruce de Mes',
  FACTURA_VENCIDA:         'Factura Vencida',
  HUERFANO_XML:            'Factura sin Pago',
  MOROSIDAD_DETECTADA:     'Morosidad'
};

const SEV_STYLE: Record<string, string> = {
  CRITICA: 'border-red-500/30 bg-red-500/5',
  MEDIA:   'border-yellow-500/30 bg-yellow-500/5',
  BAJA:    'border-blue-500/30 bg-blue-500/5',
  EXITO:   'border-green-500/30 bg-green-500/5',
}

const SEV_BADGE: Record<string, string> = {
  CRITICA: 'bg-red-500/20 text-red-500',
  MEDIA:   'bg-yellow-500/20 text-yellow-500',
  BAJA:    'bg-blue-500/20 text-blue-500',
  EXITO:   'bg-green-500/20 text-green-500',
}

export default function AlertaItem({ alerta }: { alerta: Alerta }) {
  const [pending, start] = useTransition()

  function accion(estado: 'Resuelto' | 'Ignorado') {
    start(() => resolverAlerta(alerta.id, estado))
  }

  const label = TIPO_LABEL[alerta.tipo_alerta] || alerta.tipo_alerta
  const style = SEV_STYLE[alerta.severidad] || 'border-zinc-800 bg-zinc-900/50'
  const badge = SEV_BADGE[alerta.severidad] || 'bg-zinc-800 text-zinc-400'

  return (
    <div className={`group rounded-lg border px-3 py-2 flex gap-4 items-start transition-all hover:border-zinc-600 ${style} ${pending ? 'opacity-50' : ''}`}>
      <div className="flex flex-col gap-1.5 shrink-0 pt-1">
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider ${badge}`}>
          {alerta.severidad}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] font-bold text-zinc-100 mb-0.5 uppercase tracking-tight">
          {label}
        </h4>
        <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2 mb-1.5">
          {alerta.descripcion}
        </p>
        
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            {alerta.uuid_referencia?.substring(0, 8) || 'GLOBAL'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            {new Date(alerta.created_at).toLocaleDateString('es-MX')}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
        <button 
          onClick={() => accion('Resuelto')}
          className="px-2 py-0.5 text-[9px] bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 font-bold uppercase"
        >
          Resuelto
        </button>
        <button 
          onClick={() => accion('Ignorado')}
          className="px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-400 font-bold uppercase"
        >
          Ignorar
        </button>
      </div>
    </div>
  )
}
