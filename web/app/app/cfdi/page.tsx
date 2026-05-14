import { createClient } from '@/lib/supabase/server'
import CFDIUpload from '@/components/app/CFDIUpload'

export const dynamic = 'force-dynamic'

const TIPO: Record<string, string> = { I: 'Ingreso', E: 'Egreso', P: 'Pago', N: 'Nómina', T: 'Traslado' }

export default async function CfdiPage() {
  const supabase = await createClient()

  const { data: cfdis } = await supabase
    .from('cfdi_comprobantes')
    .select('uuid, fecha_emision, tipo_comprobante, metodo_pago, rfc_emisor, rfc_receptor, total, estado_sat')
    .order('fecha_emision', { ascending: false })
    .limit(200)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">CFDIs</h1>
        <p className="text-sm text-gray-400 mt-1">Importa y analiza tus comprobantes fiscales</p>
      </div>

      <CFDIUpload />

      {(cfdis?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-400">{cfdis!.length} comprobante{cfdis!.length !== 1 ? 's' : ''}</p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs">
                  <th className="text-left px-4 py-3">UUID</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Método</th>
                  <th className="text-left px-4 py-3">Emisor</th>
                  <th className="text-left px-4 py-3">Receptor</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cfdis!.map((c) => (
                  <tr key={c.uuid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.uuid.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-gray-300">{new Date(c.fecha_emision).toLocaleDateString('es-MX')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.tipo_comprobante === 'I' ? 'bg-green-500/20 text-green-400' :
                        c.tipo_comprobante === 'E' ? 'bg-red-500/20 text-red-400' :
                        c.tipo_comprobante === 'P' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {TIPO[c.tipo_comprobante] ?? c.tipo_comprobante}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{c.metodo_pago ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.rfc_emisor}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.rfc_receptor}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(c.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.estado_sat === 'Vigente' ? 'bg-green-500/20 text-green-400' :
                        c.estado_sat === 'Cancelado' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {c.estado_sat}
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
