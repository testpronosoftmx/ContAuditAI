'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export interface MensualData {
  mes: string
  ingreso: number
  egreso: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
  return (
    <div className="rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="text-gray-400 font-medium">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">
          {p.name === 'ingreso' ? 'Ingreso' : 'Egreso'}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function CfdiMensualChart({ data }: { data: MensualData[] }) {
  if (!data.length) return (
    <p className="text-xs text-gray-500 text-center py-8">Sin datos mensuales</p>
  )

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}k` : String(v)}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          formatter={(value) => <span className="text-xs text-gray-400">{value === 'ingreso' ? 'Ingreso' : 'Egreso'}</span>}
          iconType="square"
          iconSize={8}
        />
        <Bar dataKey="ingreso" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="egreso"  fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
