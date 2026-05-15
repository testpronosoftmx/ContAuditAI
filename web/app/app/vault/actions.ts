'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function subirEvidencia(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()
  if (!tu) return { error: 'Tenant no encontrado' }

  const file      = formData.get('file') as File | null
  const cfdiUuid  = formData.get('cfdi_uuid') as string | null
  if (!file || !cfdiUuid) return { error: 'Faltan datos' }
  if (file.size > 10 * 1024 * 1024) return { error: 'El archivo supera 10 MB' }

  const ext          = file.name.split('.').pop() ?? 'bin'
  const storagePath  = `${tu.tenant_id}/${cfdiUuid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const buffer       = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from('materialidad')
    .upload(storagePath, buffer, { contentType: file.type || `application/${ext}`, upsert: false })
  if (upErr) return { error: upErr.message }

  const { error: dbErr } = await supabase
    .from('materialidad_evidencias')
    .insert({
      tenant_id:    tu.tenant_id,
      cfdi_uuid:    cfdiUuid,
      nombre:       file.name,
      tipo_mime:    file.type,
      storage_path: storagePath,
      subido_por:   user.id,
    })
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/app/vault')
  return { ok: true }
}

export async function eliminarEvidencia(id: string, storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  await supabase.storage.from('materialidad').remove([storagePath])

  const { error } = await supabase
    .from('materialidad_evidencias')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/app/vault')
  return { ok: true }
}

export async function getSignedUrl(storagePath: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('materialidad')
    .createSignedUrl(storagePath, 3600)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
