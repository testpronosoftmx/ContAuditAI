'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type CfdiRow = {
  uuid: string
  rfc_emisor: string
  rfc_receptor: string
  fecha_emision: string
  tipo_comprobante: string
  metodo_pago: string
  subtotal: string
  iva: string
  total: string
}

type UploadState = {
  insertados?: number
  omitidos?: number
  errores?: string[]
  error?: string
}

function attr(xml: string, name: string): string {
  const m = xml.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))
  return m?.[1] ?? ''
}

function parseCFDI(xml: string, filename: string): CfdiRow | null {
  try {
    const uuid    = attr(xml, 'UUID')
    const fecha   = attr(xml, 'Fecha')
    const tipo    = attr(xml, 'TipoDeComprobante')
    const metodo  = attr(xml, 'MetodoPago')
    const subtotal = attr(xml, 'SubTotal')
    const total   = attr(xml, 'Total')
    const iva     = attr(xml, 'TotalImpuestosTrasladados') || '0'

    // Emisor y Receptor están en elementos distintos — buscamos por contexto
    const emisorMatch   = xml.match(/<cfdi:Emisor[^>]*Rfc="([^"]+)"/i)
    const receptorMatch = xml.match(/<cfdi:Receptor[^>]*Rfc="([^"]+)"/i)
    const rfcEmisor   = emisorMatch?.[1] ?? ''
    const rfcReceptor = receptorMatch?.[1] ?? ''

    if (!uuid || !fecha || !tipo || !rfcEmisor || !rfcReceptor) return null

    return { uuid, rfc_emisor: rfcEmisor, rfc_receptor: rfcReceptor,
             fecha_emision: fecha, tipo_comprobante: tipo,
             metodo_pago: metodo, subtotal, iva, total }
  } catch {
    return null
  }
}

export async function subirCFDIs(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const archivos = formData.getAll('xmls') as File[]
  if (!archivos.length) return { error: 'No seleccionaste ningún archivo.' }

  const cfdis: CfdiRow[] = []
  const errores: string[] = []

  for (const file of archivos) {
    const texto = await file.text()
    const cfdi  = parseCFDI(texto, file.name)
    if (cfdi) {
      cfdis.push(cfdi)
    } else {
      errores.push(file.name)
    }
  }

  if (!cfdis.length) {
    return { error: 'Ningún archivo pudo parsearse como CFDI 4.0.', errores }
  }

  const supabase = await createClient()
  const { data: insertados, error: rpcError } = await supabase
    .rpc('insertar_cfdis', { p_cfdis: cfdis })

  if (rpcError) return { error: `Error al guardar: ${rpcError.message}` }

  revalidatePath('/app/cfdi')

  return {
    insertados: insertados ?? 0,
    omitidos: cfdis.length - (insertados ?? 0),
    errores,
  }
}
