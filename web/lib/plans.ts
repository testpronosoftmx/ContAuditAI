export const PLANES = {
  gratis: {
    nombre:    'Gratis',
    cfdis_mes: 100,
    usuarios:  1,
    vault:     false,
    reportes:  false,
    badge:     'bg-zinc-800 text-zinc-400',
  },
  plata: {
    nombre:    'Plata',
    cfdis_mes: 500,
    usuarios:  3,
    vault:     true,
    reportes:  true,
    badge:     'bg-slate-700/60 text-slate-300',
  },
  oro: {
    nombre:    'Oro',
    cfdis_mes: Infinity,
    usuarios:  10,
    vault:     true,
    reportes:  true,
    badge:     'bg-yellow-500/20 text-yellow-300',
  },
} as const

export type Plan = keyof typeof PLANES

export function getPlan(plan: string): Plan {
  return (plan in PLANES ? plan : 'gratis') as Plan
}
