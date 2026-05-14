'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function ejecutarAnalisis(): Promise<{ score?: number; criticas?: number; medias?: number; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analizar_tenant')

  if (error) return { error: error.message }

  revalidatePath('/app/dashboard')
  revalidatePath('/app/alertas')
  return data as { score: number; criticas: number; medias: number }
}
