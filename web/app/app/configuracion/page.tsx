import { createClient } from '@/lib/supabase/server'
import ConfigForm from './ConfigForm'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const supabase = await createClient()

  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  const { data: cfg } = tu
    ? await supabase
        .from('configuracion_tenant')
        .select('discrepancia_minima, dias_factura_vencida, monto_materialidad')
        .eq('tenant_id', tu.tenant_id)
        .maybeSingle()
    : { data: null }

  const defaults = {
    discrepancia_minima:  cfg?.discrepancia_minima  ?? 5.00,
    dias_factura_vencida: cfg?.dias_factura_vencida ?? 30,
    monto_materialidad:   cfg?.monto_materialidad   ?? 20000.00,
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Configuración de Auditoría</h1>
        <p className="mt-1 text-sm text-gray-400">
          Ajusta los umbrales de riesgo según tu criterio contable. El motor los aplica en el siguiente análisis.
        </p>
      </div>

      <ConfigForm defaults={defaults} />

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-gray-500 space-y-1">
        <p className="text-gray-400 font-medium mb-2">Parámetros no configurables (obligaciones SAT)</p>
        <p>· Ventana 72h para timbrar CFDI post-depósito — Art. 29-A CFF</p>
        <p>· Detección EFOS/EDOS — Art. 69-B CFF</p>
        <p>· Validación PPD/CRP — Reglas CFDI 4.0</p>
        <p>· Cancelaciones retroactivas — Regla 2.7.1.25 RMF</p>
      </div>
    </div>
  )
}
