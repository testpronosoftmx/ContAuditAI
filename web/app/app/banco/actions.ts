'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type TxRow = {
  fecha_operacion: string
  monto: string
  tipo: 'Ingreso' | 'Egreso'
  concepto_bancario: string
  clave_rastreo: string
}

type BancoState = {
  insertados?: number
  error?: string
}

function parseCSV(text: string): TxRow[] {
  const lines = text.trim().split('\n').slice(1) // omitir header
  const rows: TxRow[] = []

  for (const line of lines) {
    const cols = line.split(',')
    if (cols.length < 5) continue

    const fecha    = cols[0]?.trim()
    const concepto = cols[1]?.trim() ?? ''
    const ref      = cols[2]?.trim() ?? ''
    const cargo    = parseFloat(cols[3]) || 0
    const abono    = parseFloat(cols[4]) || 0

    if (!fecha) continue
    if (cargo <= 0 && abono <= 0) continue

    rows.push({
      fecha_operacion: `${fecha}T12:00:00`,
      monto: cargo > 0 ? String(cargo) : String(abono),
      tipo: cargo > 0 ? 'Egreso' : 'Ingreso',
      concepto_bancario: concepto,
      clave_rastreo: ref,
    })
  }

  return rows
}

export async function reinicializarBanco(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reinicializar_banco')
  if (error) return { error: error.message }
  revalidatePath('/app/banco')
  revalidatePath('/app/dashboard')
  return {}
}

export async function subirBanco(
  _prev: BancoState,
  formData: FormData,
): Promise<BancoState> {
  const archivo = formData.get('csv') as File | null
  const clabe   = (formData.get('clabe') as string ?? '').trim().padEnd(18, '0').slice(0, 18)
  const banco   = (formData.get('banco') as string ?? '').trim()

  if (!archivo) return { error: 'No seleccionaste ningún archivo.' }

  const texto = await archivo.text()
  const rows  = parseCSV(texto)

  if (!rows.length) return { error: 'No se encontraron movimientos en el CSV.' }

  const supabase = await createClient()
  const { data: insertados, error: rpcError } = await supabase.rpc(
    'insertar_transacciones',
    { p_rows: rows, p_clabe: clabe, p_banco: banco },
  )

  if (rpcError) return { error: `Error al guardar: ${rpcError.message}` }

  revalidatePath('/app/banco')
  return { insertados: insertados ?? 0 }
}
