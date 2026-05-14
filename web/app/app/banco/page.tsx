import { createClient } from '@/lib/supabase/server'
import BancoUpload from '@/components/app/BancoUpload'

export const dynamic = 'force-dynamic'

export default async function BancoPage() {
  const supabase = await createClient()

  const { data: txs } = await supabase
    .from('transacciones_bancarias')
    .select('id, fecha_operacion, tipo, monto, concepto_bancario, clave_rastreo, conciliado, banco')
    .order('fecha_operacion', { ascending: false })
    .limit(200)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Banco / SPEI</h1>
        <p className="text-sm text-gray-400 mt-1">Importa tu estado de cuenta para conciliar con CFDIs</p>
      </div>

      <BancoUpload />

      {(txs?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-400">{txs!.length} movimiento{txs!.length !== 1 ? 's' : ''}</p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Concepto</th>
                  <th className="text-left px-4 py-3">Referencia</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Monto</th>
                  <th className="text-left px-4 py-3">Conciliado</th>
                </tr>
              </thead>
              <tbody>
                {txs!.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(tx.fecha_operacion).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{tx.concepto_bancario}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{tx.clave_rastreo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tx.tipo === 'Ingreso'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tx.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${
                      tx.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.tipo === 'Egreso' ? '−' : '+'}
                      {Number(tx.monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tx.conciliado
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {tx.conciliado ? 'Sí' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
