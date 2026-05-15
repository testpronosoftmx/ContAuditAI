'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORES: Record<string, string> = {
  Ingreso:  '#22c55e',
  Egreso:   '#ef4444',
  Pago:     '#6366f1',
  Nómina:   '#a855f7',
  Traslado: '#6b7280',
}

interface Props {
  data: { name: string; value: number; monto: number }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{d.name}</p>
      <p className="text-gray-400">{d.value} CFDI{d.value !== 1 ? 's' : ''}</p>
      <p style={{ color: COLORES[d.name] ?? '#fff' }} className="font-bold">
        {d.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
      </p>
    </div>
  )
}

export default function CfdiTipoChart({ data }: Props) {
  if (!data.length) return (
    <p className="text-xs text-gray-500 text-center py-8">Sin CFDIs cargados</p>
  )

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORES[entry.name] ?? '#6b7280'} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="text-xs text-gray-400">{value}</span>}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
