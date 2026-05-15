import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { PLANES, getPlan } from '@/lib/plans'

const navLinks = [
  { href: '/app/dashboard',       label: 'Dashboard' },
  { href: '/app/cfdi',            label: 'CFDIs' },
  { href: '/app/banco',           label: 'Banco / SPEI' },
  { href: '/app/conciliaciones',  label: 'Conciliaciones' },
  { href: '/app/alertas',         label: 'Alertas' },
  { href: '/app/vault',           label: 'Vault' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [{ data: tenantData }, { count: cfdisThisMonth }] = await Promise.all([
    supabase
      .from('tenant_users')
      .select('tenant_id, tenants(nombre, rfc_empresa, plan)')
      .eq('activo', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cfdi_comprobantes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString()),
  ])

  if (!tenantData) redirect('/onboarding')

  const tenant = tenantData.tenants as unknown as { nombre: string; rfc_empresa: string; plan: string } | null
  const plan   = getPlan(tenant?.plan ?? 'gratis')
  const plano  = PLANES[plan]
  const usado  = cfdisThisMonth ?? 0
  const limite = plano.cfdis_mes
  const pct    = limite === Infinity ? 0 : Math.min(100, Math.round((usado / limite) * 100))

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col p-4 gap-6">
        <Link href="/app/dashboard" className="flex items-center gap-2 px-2">
          <Image src="/logo.png" alt="ContAuditAI" width={28} height={28} className="rounded" />
          <span className="text-sm font-bold tracking-tight">ContAuditAI</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          {tenant && (
            <div className="px-3 pb-3 border-b border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white truncate">{tenant.nombre}</p>
                  <p className="text-xs text-gray-500 font-mono">{tenant.rfc_empresa}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase shrink-0 ${plano.badge}`}>
                  {plano.nombre}
                </span>
              </div>

              {/* Medidor CFDIs/mes */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>CFDIs este mes</span>
                  <span className={pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-gray-400'}>
                    {usado}{limite === Infinity ? '' : `/${limite}`}
                  </span>
                </div>
                {limite !== Infinity && (
                  <div className="w-full h-1 rounded-full bg-white/10">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 px-3 truncate">{user.email}</p>
          <form action="/api/auth/logout" method="post">
            <button className="w-full rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-white/10 text-left transition-colors">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
