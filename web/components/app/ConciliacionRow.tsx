'use client'

import { useState } from 'react'

type ConciliacionRowProps = {
  id: string
  cfdi_uuid: string
  monto_aplicado: number
  confianza: string
  cfdi_fecha: string | null
  cfdi_rfc_emisor: string | null
  cfdi_rfc_receptor: string | null
  cfdi_total: number
  tx_fecha: string | null
  tx_concepto: string | null
  tx_rastreo: string | null
  tx_monto: number
}

export default function ConciliacionRow({
  id,
  cfdi_uuid,
  monto_aplicado,
  confianza,
  cfdi_fecha,
  cfdi_rfc_emisor,
  cfdi_rfc_receptor,
  cfdi_total,
  tx_fecha,
  tx_concepto,
  tx_rastreo,
  tx_monto,
}: ConciliacionRowProps) {
  const [open, setOpen] = useState(false)

  const diferencia   = Math.abs(cfdi_total - tx_monto)
  const fechaCfdi    = cfdi_fecha ? new Date(cfdi_fecha).toLocaleDateString('es-MX') : '—'
  const fechaBanco   = tx_fecha   ? new Date(tx_fecha).toLocaleDateString('es-MX')   : '—'
  const fmtMXN       = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
  const badgeClass   = confianza === 'ALTA'
    ? 'bg-green-500/20 text-green-400'
    : 'bg-yellow-500/20 text-yellow-400'

  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <td className="px-4 py-3 font-mono text-xs text-indigo-300">
          {cfdi_uuid.slice(0, 8).toUpperCase()}
        </td>
        <td className="px-4 py-3 text-gray-300 text-xs">{fechaCfdi}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-400">{cfdi_rfc_emisor ?? '—'}</td>
        <td className="px-4 py-3 text-right tabular-nums text-gray-200">
          {fmtMXN(cfdi_total)}
        </td>
        <td className="px-4 py-3 text-gray-300 text-xs">{fechaBanco}</td>
        <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">
          {tx_concepto ?? tx_rastreo ?? '—'}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-green-400">
          {fmtMXN(tx_monto)}
        </td>
        <td className={`px-4 py-3 text-right tabular-nums text-xs ${diferencia > 0.5 ? 'text-yellow-400' : 'text-gray-500'}`}>
          {diferencia > 0.5 ? fmtMXN(diferencia) : '—'}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {confianza}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={9} className="p-0">
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setOpen(false)}
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
              <div
                className="relative bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider w-fit ${badgeClass}`}>
                      Confianza {confianza}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">Detalle de Conciliación</h3>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-zinc-500 hover:text-white transition-colors text-lg leading-none shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* ¿Qué es esto? */}
                <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 px-4 py-3">
                  <p className="text-xs text-indigo-300 leading-relaxed">
                    El motor de conciliación identificó que este CFDI corresponde al depósito bancario mostrado.
                    {confianza === 'ALTA'
                      ? ' El UUID de la factura aparece directamente en la referencia del banco (match exacto).'
                      : ' El monto y la fecha son compatibles, pero no hay UUID explícito en la referencia bancaria (match aproximado).'}
                  </p>
                </div>

                {/* CFDI */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Factura CFDI</p>
                  <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">UUID</span>
                      <span className="font-mono text-xs text-zinc-200">{cfdi_uuid.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Fecha emisión</span>
                      <span className="text-xs text-zinc-300">{fechaCfdi}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">RFC Emisor</span>
                      <span className="font-mono text-xs text-zinc-300">{cfdi_rfc_emisor ?? '—'}</span>
                    </div>
                    {cfdi_rfc_receptor && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">RFC Receptor</span>
                        <span className="font-mono text-xs text-zinc-300">{cfdi_rfc_receptor}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total factura</span>
                      <span className="text-xs font-bold text-white">{fmtMXN(cfdi_total)}</span>
                    </div>
                  </div>
                </div>

                {/* Banco */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Depósito Bancario</p>
                  <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Fecha operación</span>
                      <span className="text-xs text-zinc-300">{fechaBanco}</span>
                    </div>
                    {tx_concepto && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Concepto</span>
                        <span className="text-xs text-zinc-300 text-right max-w-[260px]">{tx_concepto}</span>
                      </div>
                    )}
                    {tx_rastreo && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Referencia</span>
                        <span className="font-mono text-xs text-zinc-300">{tx_rastreo}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Monto depósito</span>
                      <span className="text-xs font-bold text-green-400">{fmtMXN(tx_monto)}</span>
                    </div>
                  </div>
                </div>

                {/* Diferencia */}
                {diferencia > 0.5 && (
                  <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-bold">Diferencia detectada</p>
                      <p className="text-xs text-zinc-400 mt-0.5">El monto bancario no cubre el 100% de la factura.</p>
                    </div>
                    <span className="text-sm font-bold text-yellow-400">{fmtMXN(diferencia)}</span>
                  </div>
                )}

                {diferencia <= 0.5 && (
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <span>✓</span>
                    <span>Monto conciliado al 100% — sin diferencia</span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
