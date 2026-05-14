'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const RFC_REGEX = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/

export async function crearTenant(formData: FormData) {
  const rfc = (formData.get('rfc') as string ?? '').trim().toUpperCase()

  if (!RFC_REGEX.test(rfc)) {
    return { error: 'RFC inválido. Verifica el formato (ej: XAXX010101000).' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Crear tenant — el nombre se actualiza al subir el primer CFDI
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ rfc_empresa: rfc, nombre: rfc })
    .select('id')
    .single()

  if (tenantError) {
    if (tenantError.code === '23505') {
      return { error: 'Este RFC ya tiene una cuenta registrada.' }
    }
    return { error: 'Error al crear la empresa. Intenta de nuevo.' }
  }

  // Asignar usuario como admin del tenant recién creado
  const { error: userError } = await supabase
    .from('tenant_users')
    .insert({ tenant_id: tenant.id, user_id: user.id, rol: 'admin' })

  if (userError) {
    return { error: 'Error al configurar tu cuenta. Intenta de nuevo.' }
  }

  redirect('/app/dashboard')
}
