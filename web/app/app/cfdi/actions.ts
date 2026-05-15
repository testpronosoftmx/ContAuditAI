'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { PLANES, getPlan } from '@/lib/plans'

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
  concepto: string
  isr_retenido: string
  iva_retenido: string
}

type CrpRow = {
  uuid_pago: string
  uuid_relacionado: string
  fecha_pago: string
  monto_pagado: number
  tenant_id: string
}

type UploadState = {
  insertados?: number
  omitidos?: number
  errores?: string[]
  error?: string
}

const init: UploadState = {}

function attr(xml: string, name: string): string {
  const m = xml.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))
  return m?.[1] ?? ''
}

function parseCFDI(xml: string): { cfdi: CfdiRow; crp?: Omit<CrpRow, 'tenant_id'> } | null {
  try {
    const uuid     = attr(xml, 'UUID')
    const fecha    = attr(xml, 'Fecha')
    const tipo     = attr(xml, 'TipoDeComprobante')
    const metodo   = attr(xml, 'MetodoPago')
    const subtotal = attr(xml, 'SubTotal')
    const total    = attr(xml, 'Total')
    const iva      = attr(xml, 'TotalImpuestosTrasladados') || '0'
    const isrRet   = attr(xml, 'TotalImpuestosRetenidos') || '0'

    const emisorMatch    = xml.match(/<cfdi:Emisor[^>]*Rfc="([^"]+)"/i)
    const receptorMatch  = xml.match(/<cfdi:Receptor[^>]*Rfc="([^"]+)"/i)
    const conceptoMatch  = xml.match(/<cfdi:Concepto[^>]*Descripcion="([^"]+)"/i)
    const ivaRetMatch    = xml.match(/<cfdi:Retencion[^>]*Impuesto="002"[^>]*Importe="([^"]+)"/i)

    const rfcEmisor   = emisorMatch?.[1]   ?? ''
    const rfcReceptor = receptorMatch?.[1] ?? ''
    const concepto    = conceptoMatch?.[1] ?? ''
    const ivaRetenido = ivaRetMatch?.[1]   ?? '0'

    if (!uuid || !fecha || !tipo || !rfcEmisor || !rfcReceptor) return null

    const cfdi: CfdiRow = {
      uuid, rfc_emisor: rfcEmisor, rfc_receptor: rfcReceptor,
      fecha_emision: fecha, tipo_comprobante: tipo,
      metodo_pago: metodo, subtotal, iva, total,
      concepto, isr_retenido: isrRet, iva_retenido: ivaRetenido,
    }

    // Para tipo P: extraer UUID de la factura relacionada via cfdi:CfdiRelacionado
    let crp: Omit<CrpRow, 'tenant_id'> | undefined
    if (tipo === 'P') {
      const relacionadoMatch = xml.match(/<cfdi:CfdiRelacionado[^>]*UUID="([^"]+)"/i)
      const uuidRelacionado  = relacionadoMatch?.[1] ?? ''
      if (uuidRelacionado) {
        crp = {
          uuid_pago:        uuid,
          uuid_relacionado: uuidRelacionado,
          fecha_pago:       fecha,
          monto_pagado:     parseFloat(total) || 0,
        }
      }
    }

    return { cfdi, crp }
  } catch {
    return null
  }
}

export async function reinicializarCFDIs(): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('reinicializar_cfdis')
  if (error) return { error: error.message }

  revalidatePath('/app/cfdi')
  revalidatePath('/app/dashboard')
  return {}
}

export async function subirCFDIs(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const archivos = formData.getAll('xmls') as File[]
  if (!archivos.length) return { error: 'No seleccionaste ningún archivo.' }

  const supabase = await createClient()

  // Verificar límite del plan
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenants(plan)')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  const plan   = getPlan((tenantUser?.tenants as { plan?: string } | null)?.plan ?? 'gratis')
  const limite = PLANES[plan].cfdis_mes

  if (limite !== Infinity) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const { count: usado } = await supabase
      .from('cfdi_comprobantes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString())

    const disponibles = limite - (usado ?? 0)
    if (disponibles <= 0) {
      return { error: `Límite de ${limite} CFDIs/mes alcanzado (plan ${PLANES[plan].nombre}). Actualiza tu plan para continuar.` }
    }
    if (archivos.length > disponibles) {
      return { error: `Solo puedes subir ${disponibles} CFDIs más este mes (plan ${PLANES[plan].nombre}, límite ${limite}).` }
    }
  }

  const cfdis: CfdiRow[] = []
  const crps:  Omit<CrpRow, 'tenant_id'>[] = []
  const errores: string[] = []

  for (const file of archivos) {
    const texto     = await file.text()
    const resultado = parseCFDI(texto)
    if (resultado) {
      cfdis.push(resultado.cfdi)
      if (resultado.crp) crps.push(resultado.crp)
    } else {
      errores.push(file.name)
    }
  }

  if (!cfdis.length) {
    return { error: 'Ningún archivo pudo parsearse como CFDI 4.0.', errores }
  }

  const { data: insertados, error: rpcError } = await supabase
    .rpc('insertar_cfdis', { p_cfdis: cfdis })

  if (rpcError) return { error: `Error al guardar: ${rpcError.message}` }

  // Insertar Complementos de Pago (tipo P) en cfdi_pagos
  if (crps.length > 0) {
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (tenantUser?.tenant_id) {
      const rows: CrpRow[] = crps.map(c => ({ ...c, tenant_id: tenantUser.tenant_id }))
      await supabase
        .from('cfdi_pagos')
        .upsert(rows, { onConflict: 'uuid_pago' })
    }
  }

  revalidatePath('/app/cfdi')

  return {
    insertados: insertados ?? 0,
    omitidos:   cfdis.length - (insertados ?? 0),
    errores,
  }
}
