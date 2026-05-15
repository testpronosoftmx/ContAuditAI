import { createClient } from '@/lib/supabase/server'
import { getPlan, PLANES } from '@/lib/plans'
import VaultCfdiPanel from '@/components/app/VaultCfdiPanel'

export const dynamic = 'force-dynamic'

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ uuid?: string }>
}) {
  const { uuid: autoUuid } = await searchParams
  const supabase = await createClient()

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id, tenants(plan)')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  const plan = getPlan(
    (tenantUser?.tenants as { plan?: string } | null)?.plan ?? 'gratis'
  )

  if (!PLANES[plan].vault) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Vault de Materialidad</h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center flex flex-col gap-3">
          <p className="text-4xl">🔒</p>
          <p className="text-white font-semibold">Disponible en plan Plata u Oro</p>
          <p className="text-sm text-gray-400">
            Adjunta contratos, cotizaciones y evidencia de entrega por CFDI para cumplir Art. 49-Bis CFF.
          </p>
        </div>
      </div>
    )
  }

  const tenantId = tenantUser!.tenant_id

  // CFDIs con alertas activas + todos los CFDIs con evidencias
  const [{ data: cfdisConAlerta }, { data: evidencias }] = await Promise.all([
    supabase
      .from('alertas_riesgo')
      .select('uuid_referencia')
      .eq('estado', 'Pendiente')
      .eq('tipo_alerta', 'MATERIALIDAD_FALTANTE')
      .not('uuid_referencia', 'is', null),
    supabase
      .from('materialidad_evidencias')
      .select('id, cfdi_uuid, nombre, tipo_mime, storage_path, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ])

  // UUIDs únicos con alerta
  const uuidsConAlerta = [...new Set(
    (cfdisConAlerta ?? []).map(a => a.uuid_referencia as string).filter(Boolean)
  )]

  // UUIDs únicos con evidencia
  const uuidsConEvidencia = [...new Set(
    (evidencias ?? []).map(e => e.cfdi_uuid)
  )]

  // Unión: mostrar CFDIs con alerta O con evidencia ya cargada
  const todosUuids = [...new Set([...uuidsConAlerta, ...uuidsConEvidencia])]

  // Detalles de los CFDIs
  const { data: cfdis } = todosUuids.length
    ? await supabase
        .from('cfdi_comprobantes')
        .select('uuid, rfc_emisor, rfc_receptor, fecha_emision, total, concepto, tipo_comprobante')
        .in('uuid', todosUuids)
        .order('fecha_emision', { ascending: false })
    : { data: [] }

  // Deduplicar CFDIs por UUID (puede haber duplicados si el mismo XML se subió más de una vez)
  const cfdiUnicos = [...new Map((cfdis ?? []).map(c => [c.uuid, c])).values()]

  // Agrupar evidencias por cfdi_uuid
  const evidenciasPorCfdi = new Map<string, typeof evidencias>()
  for (const ev of evidencias ?? []) {
    if (!evidenciasPorCfdi.has(ev.cfdi_uuid)) evidenciasPorCfdi.set(ev.cfdi_uuid, [])
    evidenciasPorCfdi.get(ev.cfdi_uuid)!.push(ev)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Vault de Materialidad</h1>
        <p className="text-sm text-gray-400 mt-1">
          Adjunta evidencia documental por CFDI — Art. 49-Bis CFF
        </p>
      </div>

      {todosUuids.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-gray-500 text-sm">
          Sin CFDIs con alertas activas. Ejecuta el análisis desde el Dashboard.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cfdiUnicos.map(cfdi => (
            <VaultCfdiPanel
              key={cfdi.uuid}
              cfdi={cfdi}
              tieneAlerta={uuidsConAlerta.includes(cfdi.uuid)}
              evidencias={evidenciasPorCfdi.get(cfdi.uuid) ?? []}
              autoExpand={autoUuid?.toLowerCase() === cfdi.uuid.toLowerCase()}
            />
          ))}
        </div>
      )}
    </div>
  )
}
