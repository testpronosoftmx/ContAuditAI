interface Bloque { count: number; monto: number }

interface Props {
  pue:       Bloque
  ppdConCrp: Bloque
  ppdSinCrp: Bloque
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 })

export default function DeducibilidadWidget({ pue, ppdConCrp, ppdSinCrp }: Props) {
  const total = pue.monto + ppdConCrp.monto + ppdSinCrp.monto
  if (total === 0) {
    return <p className="text-sm text-gray-500">Sin egresos de proveedores cargados.</p>
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const items = [
    {
      label:  'PUE · Deducible',
      sub:    'Pago en una sola exhibición',
      bloque: pue,
      ok:     true,
    },
    {
      label:  'PPD + CRP · Deducible',
      sub:    'Complemento de pago emitido',
      bloque: ppdConCrp,
      ok:     true,
    },
    {
      label:  'PPD sin CRP · Riesgo IVA',
      sub:    'IVA posiblemente no acreditable',
      bloque: ppdSinCrp,
      ok:     false,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => (
        <div
          key={item.label}
          className={`rounded-xl border p-4 flex items-center gap-4 ${
            item.ok
              ? 'border-green-500/20 bg-green-500/5'
              : 'border-red-500/20 bg-red-500/5'
          }`}
        >
          <span className={`shrink-0 text-base ${item.ok ? 'text-green-400' : 'text-red-400'}`}>
            {item.ok ? '✓' : '⚠'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{item.label}</p>
            <p className="text-xs text-gray-500">{item.sub}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-white">{fmt(item.bloque.monto)}</p>
            <p className="text-xs text-gray-500">
              {item.bloque.count} fact. · {pct(item.bloque.monto)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
