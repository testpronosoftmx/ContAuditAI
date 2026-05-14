'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function resolverAlerta(id: string, estado: 'Resuelto' | 'Ignorado') {
  const supabase = await createClient()
  const { error } = await supabase.rpc('resolver_alerta', {
    p_alerta_id: id,
    p_estado:    estado,
  })
  if (!error) {
    revalidatePath('/app/alertas')
    revalidatePath('/app/dashboard')
  }
}
