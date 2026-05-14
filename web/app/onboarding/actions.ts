'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const RFC_REGEX = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/

export async function crearTenant(_prevState: { error: string }, formData: FormData) {
  const rfc = (formData.get('rfc') as string ?? '').trim().toUpperCase()

  if (!RFC_REGEX.test(rfc)) {
    return { error: 'RFC inválido. Verifica el formato (ej: XAXX010101000).' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { error: rpcError } = await supabase.rpc('crear_tenant_inicial', {
    p_rfc: rfc,
    p_nombre: rfc,
  })

  if (rpcError) {
    if (rpcError.message.includes('ya tiene un tenant')) {
      return { error: 'Este usuario ya tiene una empresa configurada.' }
    }
    if (rpcError.code === '23505') {
      return { error: 'Este RFC ya tiene una cuenta registrada.' }
    }
    return { error: 'Error al crear la empresa. Intenta de nuevo.' }
  }

  redirect('/app/dashboard')
}
