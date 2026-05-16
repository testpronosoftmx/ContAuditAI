export default function MaterialidadWidget({
  documentadas,
  pendientes,
}: {
  documentadas: number
  pendientes: number
}) {
  const total = documentadas + pendientes
  if (total === 0) {
    return <p className="text-sm text-gray-500">Sin facturas de alto valor cargadas.</p>
  }

  const pct = Math.round((documentadas / total) * 100)
  const color = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
  const bar   = pct >= 80 ? 'bg-green-500'   : pct >= 50 ? 'bg-yellow-500'   : 'bg-red-500'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <span className={`text-5xl font-bold leading-none ${color}`}>{pct}%</span>
        <span className="text-sm text-gray-400 mb-1.5">blindado</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2">
        <div className={`${bar} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
          <p className="text-2xl font-bold text-green-400">{documentadas}</p>
          <p className="text-xs text-gray-400 mt-0.5">Con evidencia</p>
        </div>
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-2xl font-bold text-red-400">{pendientes}</p>
          <p className="text-xs text-gray-400 mt-0.5">Sin evidencia</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">Facturas de alto valor · Art. 49-Bis CFF</p>
    </div>
  )
}
