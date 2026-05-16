export const DIVISIONES: Record<string, string> = {
  '01': 'Genérico / Otros',
  '10': 'Minerales y metales',
  '11': 'Petróleo y gas',
  '14': 'Papel e impresión',
  '25': 'Componentes electrónicos',
  '27': 'Equipo eléctrico',
  '31': 'Materiales manufacturados',
  '40': 'Sistemas de distribución',
  '43': 'TI y telecomunicaciones',
  '44': 'Equipo de oficina',
  '46': 'Defensa y seguridad',
  '47': 'Limpieza y suministros',
  '48': 'Maquinaria industrial',
  '50': 'Alimentos y bebidas',
  '51': 'Farmacéuticos',
  '52': 'Artículos domésticos',
  '53': 'Ropa y accesorios',
  '55': 'Productos publicados',
  '56': 'Mobiliario',
  '60': 'Materiales de construcción',
  '70': 'Servicios agrícolas',
  '72': 'Construcción y obra',
  '73': 'Mantenimiento y reparación',
  '76': 'Servicios industriales',
  '77': 'Servicios ambientales',
  '78': 'Transporte y logística',
  '80': 'Gestión, finanzas y admón.',
  '81': 'Ingeniería y tecnología',
  '82': 'Diseño y editorial',
  '84': 'Capacitación y enseñanza',
  '85': 'Servicios de salud',
  '86': 'Servicios sociales',
  '92': 'Recreación y turismo',
  '93': 'Hospedaje y alimentos',
  '94': 'Servicios personales',
}

interface Categoria {
  division: string
  nombre:   string
  total:    number
  facturas: number
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 })

export default function GastoCategoriasWidget({ data }: { data: Categoria[] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-gray-500">
        Sin datos de categoría. Sube los XMLs tras aplicar la migración.
      </p>
    )
  }

  const totalGasto  = data.reduce((s, d) => s + d.total, 0)
  const genericoRow = data.find(d => d.division === '01')
  const genericoPct = genericoRow ? (genericoRow.total / totalGasto) * 100 : 0
  const max         = data[0].total

  return (
    <div className="flex flex-col gap-3">
      {genericoPct > 50 && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          ⚠ {Math.round(genericoPct)}% del gasto usa clave genérica 01010101 — bandera roja SAT
        </div>
      )}
      {data.map(cat => (
        <div key={cat.division} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono text-gray-500 shrink-0 w-5">{cat.division}</span>
              <span className="text-sm text-white truncate">{cat.nombre}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-semibold text-white">{fmt(cat.total)}</span>
              <span className="text-xs text-gray-500 ml-1.5">{cat.facturas} fact.</span>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${cat.division === '01' ? 'bg-red-500' : 'bg-violet-500'}`}
              style={{ width: `${(cat.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-500 pt-1">
        Total egresos: {fmt(totalGasto)} · {data.reduce((s, d) => s + d.facturas, 0)} facturas
      </p>
    </div>
  )
}
