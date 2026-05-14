import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: { schema: 'contauditai' },
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && sessionData.session) {
      const { user } = sessionData.session

      // Upsert silencioso del perfil — solo usuarios reales quedan en la tabla.
      // Primera vez: crea la fila. Logins siguientes: actualiza sin duplicar.
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          nombre_completo: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
        { onConflict: 'id' }
      )

      // Checar si el usuario ya tiene un tenant asignado
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('activo', true)
        .limit(1)
        .maybeSingle()

      const destination = tenantUser ? next : '/onboarding'
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`)
}
