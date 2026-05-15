'use client'

import { useState, useTransition } from 'react'
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
  VENTANA_72H:             'Ventana 72h SAT',
  INGRESO_NO_FACTURADO:    'Ingreso no Facturado',
  CONCILIACION_CRUCE_MES:  'Cruce de Mes',
  FACTURA_VENCIDA:         'Factura Vencida',
  HUERFANO_XML:            'Factura sin Pago',
}

const TIPO_INFO: Record<string, { explicacion: string; accion: string; ref: string }> = {
  EFOS_DETECTADO: {
    explicacion: 'El emisor está en la lista SAT de Empresas que Facturan Operaciones Simuladas (EFOS). Las deducciones con estas facturas son no deducibles y pueden generar multas y créditos fiscales a cargo.',
    accion: 'Contacta a tu asesor fiscal de inmediato. Evalúa si la operación tiene materialidad demostrable. Considera emitir nota de crédito para revertir el efecto fiscal.',
    ref: 'Art. 69-B CFF',
  },
  CANCELACION_RETROACTIVA: {
    explicacion: 'Este CFDI fue cancelado días después de su emisión. Si ya se aplicó como pago o deducción puede generar inconsistencias ante el SAT.',
    accion: 'Verifica que no se haya declarado como deducción. Si ya se declaró, emite un CFDI de sustitución y notifica al receptor.',
    ref: 'Art. 29-A CFF · Regla 2.7.1.22 RMF',
  },
  PPD_SIN_CRP: {
    explicacion: 'Factura PPD (Pago en Parcialidades o Diferido) sin Complemento de Recepción de Pago. Sin el CRP el IVA no es acreditable para el receptor y el ingreso no se considera cobrado para ISR.',
    accion: 'Solicita al emisor el Complemento de Pago dentro de los 10 días hábiles posteriores al cobro. Si eres el emisor, genera el CRP a la brevedad.',
    ref: 'Regla 2.7.1.30 RMF 2026',
  },
  DISCREPANCIA_BANCARIA: {
    explicacion: 'El monto bancario no coincide al 100% con el total del CFDI. Puede ser pago parcial, descuento no documentado o error de conciliación.',
    accion: 'Verifica si existe nota de crédito por la diferencia. Si es pago parcial, el emisor debe emitir CRP por el monto cobrado y dejar pendiente el saldo.',
    ref: 'Art. 27 LISR',
  },
  VENTANA_72H: {
    explicacion: 'El CFDI fue expedido más de 72 horas después de recibirse el pago. El SAT exige que el comprobante se emita al momento de recibir la contraprestación.',
    accion: 'Documenta la razón del retraso. Si el CFDI es de periodo anterior al pago, evalúa si debe cancelarse y re-emitirse con la fecha correcta.',
    ref: 'Art. 29 CFF · Regla 2.7.1.1 RMF',
  },
  MATERIALIDAD_FALTANTE: {
    explicacion: 'CFDI por monto ≥ $20,000 sin evidencia de materialidad. El SAT puede impugnar la deducción si no hay prueba documental de que la operación fue real.',
    accion: 'Recaba contrato firmado, entregables (correos, informes, fotos, actas) y archívalos en el expediente. La evidencia debe ser previa o contemporánea a la factura.',
    ref: 'Art. 49-Bis CFF',
  },
  INGRESO_NO_FACTURADO: {
    explicacion: 'Depósito bancario sin CFDI correspondiente identificado. Todo ingreso debe estar respaldado por un comprobante fiscal para efectos de ISR e IVA.',
    accion: 'Identifica el origen del depósito. Si es ingreso gravado, emite el CFDI. Si es préstamo, devolución o transferencia entre cuentas propias, documéntalo.',
    ref: 'Art. 17 LISR · Art. 1 LIVA',
  },
  CONCILIACION_CRUCE_MES: {
    explicacion: 'La factura se emitió en un mes pero el cobro se registró en otro. Puede generar diferencias en la declaración mensual de IVA si el método contable es flujo de efectivo.',
    accion: 'Verifica que el IVA se haya acreditado/declarado en el mes del cobro efectivo. Revisa tu declaración del mes afectado.',
    ref: 'Art. 11 LIVA',
  },
  FACTURA_VENCIDA: {
    explicacion: 'Factura emitida hace más de 30 días sin cobro registrado. Genera riesgo de cartera incobrable y puede requerir ajuste en la estimación de cuentas malas.',
    accion: 'Contacta al cliente para gestionar el cobro. Si es incobrable, documenta los intentos de cobro para justificar su deducción como cuenta mala.',
    ref: 'Art. 31 Fracc. XVI LISR',
  },
  HUERFANO_XML: {
    explicacion: 'CFDI emitido recientemente sin cobro bancario identificado. Puede estar pendiente de pago o haberse cobrado por un canal no registrado en el sistema.',
    accion: 'Verifica si el pago se recibió en efectivo, transferencia a otra cuenta o por otro medio. Si está pendiente, inicia proceso de cobranza.',
    ref: 'Art. 29 CFF',
  },
}

const SEV_STYLE: Record<string, string> = {
  CRITICA: 'border-red-500/30 bg-red-500/5',
  MEDIA:   'border-yellow-500/30 bg-yellow-500/5',
  BAJA:    'border-blue-500/30 bg-blue-500/5',
}

const SEV_BADGE: Record<string, string> = {
  CRITICA: 'bg-red-500/20 text-red-400',
  MEDIA:   'bg-yellow-500/20 text-yellow-400',
  BAJA:    'bg-blue-500/20 text-blue-400',
}

const SEV_MODAL_BORDER: Record<string, string> = {
  CRITICA: 'border-red-500/40',
  MEDIA:   'border-yellow-500/40',
  BAJA:    'border-blue-500/40',
}

export default function AlertaItem({ alerta }: { alerta: Alerta }) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  function accion(estado: 'Resuelto' | 'Ignorado') {
    start(() => resolverAlerta(alerta.id, estado))
    setOpen(false)
  }

  const label  = TIPO_LABEL[alerta.tipo_alerta] || alerta.tipo_alerta
  const info   = TIPO_INFO[alerta.tipo_alerta]
  const style  = SEV_STYLE[alerta.severidad] || 'border-zinc-800 bg-zinc-900/50'
  const badge  = SEV_BADGE[alerta.severidad] || 'bg-zinc-800 text-zinc-400'
  const border = SEV_MODAL_BORDER[alerta.severidad] || 'border-white/10'
  const fecha  = new Date(alerta.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      {/* Tarjeta */}
      <div
        onClick={() => setOpen(true)}
        className={`group rounded-lg border px-3 py-2 flex gap-4 items-start transition-all
                    hover:border-zinc-500 cursor-pointer ${style} ${pending ? 'opacity-50' : ''}`}
      >
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
            <span>{alerta.uuid_referencia?.substring(0, 8) || 'GLOBAL'}</span>
            <span className="text-zinc-600">·</span>
            <span>Detectado: {fecha}</span>
          </div>
        </div>

        <span className="text-[9px] text-zinc-600 font-bold uppercase pt-1.5 shrink-0 group-hover:text-zinc-400 transition-colors">
          {alerta.estado === 'Pendiente' ? '›' : alerta.estado}
        </span>
      </div>

      {/* Modal de detalle */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`relative bg-gray-900 border ${border} rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider w-fit ${badge}`}>
                  {alerta.severidad}
                </span>
                <h3 className="text-base font-bold text-white mt-1">{label}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors text-lg leading-none shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Descripción */}
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-xs text-zinc-300 leading-relaxed font-mono">{alerta.descripcion}</p>
            </div>

            {/* UUID + fecha */}
            <div className="flex gap-4 text-xs text-zinc-500">
              {alerta.uuid_referencia && (
                <div>
                  <span className="text-zinc-600 uppercase tracking-wider text-[10px]">UUID</span>
                  <p className="font-mono text-zinc-300 mt-0.5">{alerta.uuid_referencia.toUpperCase()}</p>
                </div>
              )}
              <div>
                <span className="text-zinc-600 uppercase tracking-wider text-[10px]">Detectado</span>
                <p className="text-zinc-300 mt-0.5">{fecha}</p>
              </div>
            </div>

            {/* Contexto legal */}
            {info && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">¿Qué significa?</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{info.explicacion}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Acción recomendada</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{info.accion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Ref. legal:</span>
                  <span className="text-[10px] font-mono text-indigo-400">{info.ref}</span>
                </div>
              </div>
            )}

            {/* Acciones */}
            {alerta.estado === 'Pendiente' && (
              <div className="flex gap-2 pt-1 border-t border-white/10">
                <button
                  onClick={() => accion('Resuelto')}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold
                             hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Marcar como resuelto
                </button>
                <button
                  onClick={() => accion('Ignorado')}
                  disabled={pending}
                  className="px-4 rounded-lg border border-white/10 text-sm text-zinc-400
                             hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Ignorar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
