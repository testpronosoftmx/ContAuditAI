import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '/app/dashboard',       label: 'Dashboard' },
  { href: '/app/cfdi',            label: 'CFDIs' },
  { href: '/app/banco',           label: 'Banco / SPEI' },
  { href: '/app/conciliaciones',  label: 'Conciliaciones' },
  { href: '/app/alertas',         label: 'Alertas' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: tenantData } = await supabase
    .from('tenant_users')
    .select('tenant_id, tenants(nombre, rfc_empresa)')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  if (!tenantData) redirect('/onboarding')

  const tenant = tenantData.tenants as unknown as { nombre: string; rfc_empresa: string } | null

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

        <div className="mt-auto flex flex-col gap-1">
          {tenant && (
            <div className="px-3 pb-2 border-b border-white/10 mb-2">
              <p className="text-xs font-medium text-white truncate">{tenant.nombre}</p>
              <p className="text-xs text-gray-500 font-mono">{tenant.rfc_empresa}</p>
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
