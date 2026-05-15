import { createClient } from '@/lib/supabase/server'
import { getPlan, PLANES } from '@/lib/plans'
import * as XLSX from 'xlsx'

const TIPO_LABEL: Record<string, string> = {
  EFOS_DETECTADO:          'EFOS Detectado',
  PPD_SIN_CRP:             'PPD sin CRP',
  DISCREPANCIA_BANCARIA:   'Discrepancia Bancaria',
  CANCELACION_RETROACTIVA: 'Cancelación Retroactiva',
  MATERIALIDAD_FALTANTE:   'Materialidad Faltante',
  VENTANA_72H:             'Ventana 72h SAT',
  INGRESO_NO_FACTURADO:    'Ingreso no Facturado',
  CONCILIACION_CRUCE_MES:  'Cruce de Mes',
  FACTURA_VENCIDA:         'Factura Vencida',
  HUERFANO_XML:            'Factura sin Pago',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('No autorizado', { status: 401 })

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenants(plan, nombre, rfc_empresa)')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  const tenant = tenantUser?.tenants as unknown as { plan: string; nombre: string; rfc_empresa: string } | null
  const plan   = getPlan(tenant?.plan ?? 'gratis')

  if (!PLANES[plan].reportes) {
    return new Response('Reportes no disponibles en el plan Gratis. Actualiza a Plata u Oro.', { status: 403 })
  }

  const { data: alertas } = await supabase
    .from('alertas_riesgo')
    .select('tipo_alerta, severidad, descripcion, estado, created_at, uuid_referencia')
    .order('severidad')
    .order('created_at', { ascending: false })

  const rows = (alertas ?? []).map(a => ({
    'Tipo':           TIPO_LABEL[a.tipo_alerta] ?? a.tipo_alerta,
    'Severidad':      a.severidad,
    'Descripción':    a.descripcion ?? '',
    'Estado':         a.estado,
    'Fecha':          new Date(a.created_at).toLocaleDateString('es-MX'),
    'UUID Referencia': a.uuid_referencia?.toUpperCase() ?? '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 25 }, { wch: 10 }, { wch: 80 }, { wch: 12 }, { wch: 12 }, { wch: 38 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Alertas')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ContAuditAI_Alertas_${tenant?.rfc_empresa ?? 'export'}_${fecha}.xlsx"`,
    },
  })
}
