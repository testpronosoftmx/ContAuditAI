import { createClient } from '@/lib/supabase/server'
import { getPlan, PLANES } from '@/lib/plans'
import * as XLSX from 'xlsx'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('No autorizado', { status: 401 })

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenants(plan, rfc_empresa)')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  const tenant = tenantUser?.tenants as unknown as { plan: string; rfc_empresa: string } | null
  const plan   = getPlan(tenant?.plan ?? 'gratis')

  if (!PLANES[plan].reportes) {
    return new Response('Reportes no disponibles en el plan Gratis. Actualiza a Plata u Oro.', { status: 403 })
  }

  const { data: cons } = await supabase
    .from('conciliaciones')
    .select(`
      cfdi_uuid, monto_aplicado, confianza, created_at,
      tx:transacciones_bancarias(fecha_operacion, concepto_bancario, clave_rastreo, monto)
    `)
    .order('created_at', { ascending: false })

  const uuids = [...new Set((cons ?? []).map(c => c.cfdi_uuid))]
  const { data: cfdis } = uuids.length
    ? await supabase
        .from('cfdi_comprobantes')
        .select('uuid, fecha_emision, rfc_emisor, rfc_receptor, total, concepto')
        .in('uuid', uuids)
    : { data: [] }

  const cfdiMap = new Map((cfdis ?? []).map(c => [c.uuid, c]))

  const rows = (cons ?? []).map(c => {
    const cfdi     = cfdiMap.get(c.cfdi_uuid)
    const tx       = (Array.isArray(c.tx) ? c.tx[0] : c.tx) as { fecha_operacion: string; concepto_bancario: string; clave_rastreo: string; monto: number } | null
    const cfdiTotal = cfdi ? Number(cfdi.total) : 0
    const txMonto   = tx ? Number(tx.monto) : Number(c.monto_aplicado)
    const diferencia = Math.abs(cfdiTotal - txMonto)

    return {
      'UUID Factura':     c.cfdi_uuid.toUpperCase(),
      'Concepto CFDI':    (cfdi as { concepto?: string } | undefined)?.concepto ?? '',
      'RFC Emisor':       cfdi?.rfc_emisor ?? '',
      'RFC Receptor':     cfdi?.rfc_receptor ?? '',
      'Fecha CFDI':       cfdi ? new Date(cfdi.fecha_emision).toLocaleDateString('es-MX') : '',
      'Total Factura':    cfdiTotal,
      'Fecha Banco':      tx ? new Date(tx.fecha_operacion).toLocaleDateString('es-MX') : '',
      'Concepto Banco':   tx?.concepto_bancario ?? tx?.clave_rastreo ?? '',
      'Monto Banco':      txMonto,
      'Diferencia':       diferencia > 0.5 ? diferencia : 0,
      'Confianza':        c.confianza,
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 38 }, { wch: 35 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 35 },
    { wch: 14 }, { wch: 12 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Conciliaciones')

  const buf  = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ContAuditAI_Conciliaciones_${tenant?.rfc_empresa ?? 'export'}_${fecha}.xlsx"`,
    },
  })
}
