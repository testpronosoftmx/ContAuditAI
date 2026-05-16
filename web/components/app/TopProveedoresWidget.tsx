interface Proveedor {
  rfc: string
  total: number
  facturas: number
  esEfos: boolean
}

export default function TopProveedoresWidget({ data }: { data: Proveedor[] }) {
  if (!data.length) {
    return <p className="text-sm text-gray-500">Sin facturas de proveedores cargadas.</p>
  }
  const max = data[0].total

  return (
    <div className="flex flex-col gap-4">
      {data.map((p, i) => (
        <div key={p.rfc} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-500 w-4 shrink-0">#{i + 1}</span>
              <span className="text-sm font-mono text-white truncate">{p.rfc}</span>
              {p.esEfos && (
                <span className="shrink-0 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5">
                  EFOS ⚠
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-semibold text-white">
                ${p.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-gray-500 ml-1.5">{p.facturas} fact.</span>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${p.esEfos ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${(p.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
