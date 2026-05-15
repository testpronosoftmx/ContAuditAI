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

async function parsePDF(buffer: Buffer): Promise<TxRow[]> {
  // pdf-parse v2 uses a class-based API; dynamic import keeps it out of the webpack bundle
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const { text } = await parser.getText()

  const rows: TxRow[] = []
  const dateRe  = /(\d{4}-\d{2}-\d{2})/
  const moneyRe = /\$?([\d,]+\.\d{2})/g

  for (const line of text.split('\n')) {
    const dateMatch = line.match(dateRe)
    if (!dateMatch) continue

    const fecha = dateMatch[1]

    const amounts: number[] = []
    let m: RegExpExecArray | null
    moneyRe.lastIndex = 0
    while ((m = moneyRe.exec(line)) !== null) {
      amounts.push(parseFloat(m[1].replace(/,/g, '')))
    }

    // Layout: [txAmount, saldo] — last is always saldo, second-to-last is the tx
    if (amounts.length < 2) continue
    const monto = amounts[amounts.length - 2]
    if (!monto || monto <= 0) continue

    const isCargo = /CARGO|PAGO|RETIRO|COMISION/i.test(line)
    const tipo: 'Ingreso' | 'Egreso' = isCargo ? 'Egreso' : 'Ingreso'

    const afterDate     = line.slice(line.indexOf(fecha) + fecha.length).trim()
    const firstMoneyIdx = afterDate.search(/\$?[\d,]+\.\d{2}/)
    const concepto      = firstMoneyIdx > 0 ? afterDate.slice(0, firstMoneyIdx).trim() : afterDate.slice(0, 40).trim()
    const conceptoClean = concepto.replace(/^\d+\s*/, '').trim()

    rows.push({
      fecha_operacion: `${fecha}T12:00:00`,
      monto: String(monto),
      tipo,
      concepto_bancario: conceptoClean || 'Movimiento bancario',
      clave_rastreo: '',
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

  const nombre = archivo.name.toLowerCase()
  let rows: TxRow[]

  if (nombre.endsWith('.pdf')) {
    const buf = Buffer.from(await archivo.arrayBuffer())
    rows = await parsePDF(buf)
    if (!rows.length) return { error: 'No se pudieron extraer movimientos del PDF. Verifica que sea un estado de cuenta de ContAuditAI.' }
  } else {
    const texto = await archivo.text()
    rows = parseCSV(texto)
    if (!rows.length) return { error: 'No se encontraron movimientos en el CSV.' }
  }

  const supabase = await createClient()
  const { data: insertados, error: rpcError } = await supabase.rpc(
    'insertar_transacciones',
    { p_rows: rows, p_clabe: clabe, p_banco: banco },
  )

  if (rpcError) return { error: `Error al guardar: ${rpcError.message}` }

  revalidatePath('/app/banco')
  return { insertados: insertados ?? 0 }
}
