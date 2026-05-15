import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ConciliacionesPage() {
  const supabase = await createClient()

  const [{ data: cons }, { count: totalCfdis }] = await Promise.all([
    supabase
      .from('conciliaciones')
      .select(`
        id, cfdi_uuid, cfdi_fecha_emision, monto_aplicado, confianza, created_at,
        tx:transacciones_bancarias(fecha_operacion, concepto_bancario, clave_rastreo, monto)
      `)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('cfdi_comprobantes')
      .select('*', { count: 'exact', head: true })
      .eq('tipo_comprobante', 'I'),
  ])

  // Fetch CFDI details for all matched UUIDs
  const uuids = [...new Set((cons ?? []).map(c => c.cfdi_uuid))]
  const { data: cfdis } = uuids.length
    ? await supabase
        .from('cfdi_comprobantes')
        .select('uuid, fecha_emision, rfc_emisor, rfc_receptor, total')
        .in('uuid', uuids)
    : { data: [] }

  const cfdiMap = new Map((cfdis ?? []).map(c => [c.uuid, c]))

  const conciliadas = cons?.length ?? 0
  const totalFacturas = totalCfdis ?? 0
  const pct = totalFacturas > 0 ? Math.round((conciliadas / totalFacturas) * 100) : 0
  const montoTotal = (cons ?? []).reduce((s, c) => s + Number(c.monto_aplicado), 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Conciliaciones</h1>
        <p className="text-sm text-gray-400 mt-1">Pares Factura ↔ Depósito bancario identificados por el motor</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Facturas conciliadas</p>
          <p className="text-3xl font-bold text-white">{conciliadas}</p>
          <p className="text-xs text-gray-500">de {totalFacturas} facturas tipo Ingreso</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">% Conciliación</p>
          <p className={`text-3xl font-bold ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {pct}%
          </p>
          <div className="w-full h-1.5 rounded-full bg-white/10 mt-1">
            <div
              className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Monto conciliado</p>
          <p className="text-3xl font-bold text-white">
            {montoTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Tabla */}
      {conciliadas === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-gray-500 text-sm">
          Sin conciliaciones. Ejecuta el análisis desde el Dashboard.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs">
                <th className="text-left px-4 py-3">Factura UUID</th>
                <th className="text-left px-4 py-3">Fecha CFDI</th>
                <th className="text-left px-4 py-3">Emisor</th>
                <th className="text-right px-4 py-3">Total CFDI</th>
                <th className="text-left px-4 py-3">Fecha banco</th>
                <th className="text-left px-4 py-3">Concepto banco</th>
                <th className="text-right px-4 py-3">Monto banco</th>
                <th className="text-right px-4 py-3">Diferencia</th>
                <th className="text-center px-4 py-3">Confianza</th>
              </tr>
            </thead>
            <tbody>
              {(cons ?? []).map(c => {
                const cfdi = cfdiMap.get(c.cfdi_uuid)
                const tx = (Array.isArray(c.tx) ? c.tx[0] : c.tx) as { fecha_operacion: string; concepto_bancario: string; clave_rastreo: string; monto: number } | null
                const totalCfdi = cfdi ? Number(cfdi.total) : 0
                const montoBanco = tx ? Number(tx.monto) : Number(c.monto_aplicado)
                const diferencia = Math.abs(totalCfdi - montoBanco)

                return (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-300">
                      {c.cfdi_uuid.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {cfdi ? new Date(cfdi.fecha_emision).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {cfdi?.rfc_emisor ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-200">
                      {totalCfdi.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {tx ? new Date(tx.fecha_operacion).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">
                      {tx?.concepto_bancario ?? tx?.clave_rastreo ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-400">
                      {montoBanco.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums text-xs ${diferencia > 0.5 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {diferencia > 0.5
                        ? diferencia.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.confianza === 'ALTA'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {c.confianza}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
