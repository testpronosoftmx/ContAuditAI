'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function resolverAlerta(id: string, estado: 'Resuelto' | 'Ignorado') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('alertas_riesgo')
    .update({ estado })
    .eq('id', id)
  if (!error) {
    revalidatePath('/app/alertas')
    revalidatePath('/app/dashboard')
  }
}
