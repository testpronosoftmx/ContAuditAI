import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingForm from '@/components/app/OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si ya tiene tenant, no necesita onboarding
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  if (tenantUser) redirect('/app/dashboard')

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-2xl font-bold text-white">ContAuditAI</span>
          <h1 className="text-lg font-semibold text-white">Configura tu empresa</h1>
          <p className="text-sm text-gray-400">
            Ingresa el RFC de tu empresa para comenzar. El nombre lo tomaremos
            automáticamente de tu primer CFDI.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <OnboardingForm />
        </div>

        <p className="text-xs text-center text-gray-600">
          Al continuar aceptas que ContAuditAI procesará tus CFDIs
          para análisis fiscal preventivo.
        </p>
      </div>
    </main>
  )
}
