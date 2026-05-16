'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function guardarConfiguracion(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const discrepanciaMinima  = parseFloat(formData.get('discrepancia_minima') as string)
  const diasFacturaVencida  = parseInt(formData.get('dias_factura_vencida') as string, 10)
  const montoMaterialidad   = parseFloat(formData.get('monto_materialidad') as string)

  if (isNaN(discrepanciaMinima) || isNaN(diasFacturaVencida) || isNaN(montoMaterialidad)) {
    return { error: 'Valores inválidos' }
  }

  const { error } = await supabase.rpc('guardar_configuracion', {
    p_discrepancia_minima:  discrepanciaMinima,
    p_dias_factura_vencida: diasFacturaVencida,
    p_monto_materialidad:   montoMaterialidad,
  })

  if (error) return { error: error.message }

  revalidatePath('/app/configuracion')
  return { ok: true }
}
