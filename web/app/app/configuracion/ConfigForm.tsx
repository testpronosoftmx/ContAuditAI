'use client'

import { useRef, useState, useTransition } from 'react'
import { guardarConfiguracion } from './actions'

interface Props {
  defaults: {
    discrepancia_minima:  number
    dias_factura_vencida: number
    monto_materialidad:   number
  }
}

export default function ConfigForm({ defaults }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setResult(null)
    startTransition(async () => {
      const res = await guardarConfiguracion(fd)
      setResult(res)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">

        {/* Discrepancia mínima */}
        <div className="p-5 flex flex-col gap-2">
          <label htmlFor="discrepancia_minima" className="text-sm font-medium text-white">
            Alértame discrepancias mayores a
          </label>
          <p className="text-xs text-gray-500">
            Diferencia entre monto facturado y cobrado para marcarla como "Retención posible". Debajo de este umbral se ignora (centavos de redondeo).
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400 text-sm">$</span>
            <input
              id="discrepancia_minima"
              name="discrepancia_minima"
              type="number"
              step="0.01"
              min="0"
              max="999.99"
              defaultValue={defaults.discrepancia_minima}
              required
              className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white
                         focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-xs">MXN</span>
          </div>
        </div>

        {/* Días factura vencida */}
        <div className="p-5 flex flex-col gap-2">
          <label htmlFor="dias_factura_vencida" className="text-sm font-medium text-white">
            Considerar factura vencida a los
          </label>
          <p className="text-xs text-gray-500">
            Días sin cobro para escalar de "Sin pago reciente" (HUÉRFANO) a "Factura vencida" (VENCIDA). Ajusta según tus términos de crédito habituales.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <input
              id="dias_factura_vencida"
              name="dias_factura_vencida"
              type="number"
              step="1"
              min="1"
              max="365"
              defaultValue={defaults.dias_factura_vencida}
              required
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white
                         focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-xs">días</span>
          </div>
        </div>

        {/* Monto materialidad */}
        <div className="p-5 flex flex-col gap-2">
          <label htmlFor="monto_materialidad" className="text-sm font-medium text-white">
            Monto mínimo para exigir materialidad
          </label>
          <p className="text-xs text-gray-500">
            Facturas por encima de este monto requieren contratos, entregables o evidencia documental (Art. 49-Bis CFF). Recomendado: ≥ $10,000.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400 text-sm">$</span>
            <input
              id="monto_materialidad"
              name="monto_materialidad"
              type="number"
              step="1000"
              min="1000"
              defaultValue={defaults.monto_materialidad}
              required
              className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white
                         focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-xs">MXN</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white
                     hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Guardando…' : 'Guardar configuración'}
        </button>

        {result?.ok && (
          <span className="text-sm text-green-400">
            ✓ Configuración guardada. Se aplicará en el próximo análisis.
          </span>
        )}
        {result?.error && (
          <span className="text-sm text-red-400">
            Error: {result.error}
          </span>
        )}
      </div>
    </form>
  )
}
