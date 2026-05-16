import { createClient } from '@/lib/supabase/server'
import AnalisisBtn from '@/components/app/AnalisisBtn'
import RiskScoreChart from '@/components/app/RiskScoreChart'
import CfdiTipoChart from '@/components/app/CfdiTipoChart'
import CfdiMensualChart from '@/components/app/CfdiMensualChart'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TIPO_LABEL: Record<string, string> = {
  EFOS_DETECTADO:          'EFOS Detectado',
  PPD_SIN_CRP:             'PPD sin CRP',
  DISCREPANCIA_BANCARIA:   'Discrepancia Bancaria',
  CANCELACION_RETROACTIVA: 'Cancelación Retroactiva',
  MATERIALIDAD_FALTANTE:   'Materialidad Faltante',
  VENTANA_72H:             'Ventana 72h',
  INGRESO_NO_FACTURADO:    'Ingreso No Facturado',
  FACTURA_VENCIDA:         'Factura Vencida',
  CONCILIACION_CRUCE_MES:  'Cruce de Mes',
  HUERFANO_XML:            'Factura sin Pago',
}

const TIPO_NOMBRE: Record<string, string> = {
  I: 'Ingreso', E: 'Egreso', P: 'Pago', N: 'Nómina', T: 'Traslado',
}

function scoreColor(s: number) {
  if (s >= 80) return { text: 'text-green-400', label: 'Riesgo bajo' }
  if (s >= 50) return { text: 'text-yellow-400', label: 'Riesgo medio' }
  return { text: 'text-red-400', label: 'Riesgo alto' }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: riskData },
    { data: historial },
    { data: alertas_raw },
    { count: cfdisCount },
    { count: txCount },
    { data: cfdiRaw },
    { count: conciliadasCount },
    { data: tenantData },
  ] = await Promise.all([
    supabase.from('risk_scores').select('score, factores, periodo').order('periodo', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('risk_scores').select('score, periodo').order('periodo', { ascending: true }).limit(6),
    supabase.from('alertas_riesgo').select('id, tipo_alerta, severidad, descripcion').eq('estado', 'Pendiente').order('created_at', { ascending: false }).limit(20),
    supabase.from('cfdi_comprobantes').select('*', { count: 'exact', head: true }),
    supabase.from('transacciones_bancarias').select('*', { count: 'exact', head: true }),
    supabase.from('cfdi_comprobantes').select('tipo_comprobante, total, fecha_emision'),
    supabase.from('conciliaciones').select('*', { count: 'exact', head: true }).eq('confianza', 'ALTA'),
    supabase.from('tenant_users').select('tenants(nombre, rfc_empresa)').eq('activo', true).limit(1).maybeSingle(),
  ])

  const tenant = (tenantData?.tenants as unknown as { nombre: string; rfc_empresa: string } | null)

  const tipoMap    = new Map<string, { count: number; monto: number }>()
  const mensualMap = new Map<string, { ingreso: number; egreso: number }>()

  for (const c of cfdiRaw ?? []) {
    const nombre = TIPO_NOMBRE[c.tipo_comprobante] ?? c.tipo_comprobante
    const monto  = Number(c.total) || 0
    const t = tipoMap.get(nombre) ?? { count: 0, monto: 0 }
    tipoMap.set(nombre, { count: t.count + 1, monto: t.monto + monto })

    const mes = new Date(c.fecha_emision).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
    const m = mensualMap.get(mes) ?? { ingreso: 0, egreso: 0 }
    if (c.tipo_comprobante === 'I') mensualMap.set(mes, { ...m, ingreso: m.ingreso + monto })
    if (c.tipo_comprobante === 'E') mensualMap.set(mes, { ...m, egreso:  m.egreso  + monto })
  }

  const cfdiTipoData    = Array.from(tipoMap.entries()).map(([name, v]) => ({ name, value: v.count, monto: v.monto }))
  const cfdiMensualData = Array.from(mensualMap.entries()).map(([mes, v]) => ({ mes, ...v }))

  const alertas = (alertas_raw ?? []).slice(0, 5)

  const score    = riskData?.score != null ? Number(riskData.score) : null
  const factores = riskData?.factores as Record<string, number> | null
  const criticas = factores?.criticas ?? 0
  const medias   = factores?.medias   ?? 0
  const sc       = score !== null ? scoreColor(score) : null

  const totalCfdisIngreso = (cfdiRaw ?? []).filter(c => c.tipo_comprobante === 'I').length
  const conciliadas = conciliadasCount ?? 0
  const pctConc = totalCfdisIngreso > 0 ? Math.round((conciliadas / totalCfdisIngreso) * 100) : 0

  const isEmpty = (cfdisCount ?? 0) === 0 && (txCount ?? 0) === 0

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            {tenant ? `${tenant.nombre} · ${tenant.rfc_empresa}` : 'Cargando...'}
          </p>
        </div>
        <AnalisisBtn />
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="font-semibold text-lg mb-2">Bienvenido a ContAuditAI</h2>
          <p className="text-sm text-gray-400 mb-8">Sigue estos 3 pasos para generar tu primer análisis de riesgo fiscal.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: 'Sube tus CFDIs',
                desc: 'XMLs emitidos y recibidos del periodo. Acepta carga masiva de múltiples archivos.',
                href: '/app/cfdi',
                cta: 'Ir a CFDIs →',
              },
              {
                step: 2,
                title: 'Sube tu estado de cuenta',
                desc: 'CSV con movimientos bancarios. El motor los cruza con tus facturas automáticamente.',
                href: '/app/banco',
                cta: 'Ir a Banco →',
              },
              {
                step: 3,
                title: 'Ejecuta el análisis',
                desc: 'El motor concilia facturas vs depósitos y genera alertas de riesgo accionables.',
                href: null,
                cta: null,
              },
            ].map(item => (
              <div key={item.step} className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 flex flex-col gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-sm shrink-0">
                  {item.step}
                </div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-sm text-gray-400 flex-1">{item.desc}</p>
                {item.href && (
                  <Link href={item.href} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    {item.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Score + KPIs */}
      {!isEmpty && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Risk Score</p>
            <div className="flex items-end gap-3">
              <p className={`text-6xl font-bold leading-none ${sc?.text ?? 'text-gray-500'}`}>
                {score !== null ? Math.round(score) : '—'}
              </p>
              <p className="text-sm text-gray-400 mb-1">/100</p>
            </div>
            {score !== null && (
              <>
                <div className="relative mt-1">
                  <div
                    className="w-full h-3 rounded-full"
                    style={{ background: 'linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)' }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-5 rounded bg-white shadow-lg border-2 border-gray-800"
                    style={{ left: `clamp(0px, calc(${score}% - 6px), calc(100% - 12px))` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 -mt-0.5">
                  <span>← Alto riesgo</span>
                  <span>Bajo riesgo →</span>
                </div>
                <p className={`text-sm font-medium ${sc!.text}`}>{sc!.label}</p>
              </>
            )}
            {score === null && (
              <p className="text-xs text-gray-500">Ejecuta el análisis para calcular</p>
            )}
          </div>

          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: 'CFDIs cargados',    value: cfdisCount ?? 0, color: 'text-white',        sub: null },
              { label: 'Mov. bancarios',    value: txCount    ?? 0, color: 'text-white',        sub: null },
              { label: 'Alertas críticas',  value: criticas,        color: criticas > 0 ? 'text-red-400'    : 'text-white', sub: null },
              {
                label: 'Conciliadas',
                value: `${conciliadas}/${totalCfdisIngreso}`,
                color: pctConc >= 80 ? 'text-green-400' : pctConc >= 50 ? 'text-yellow-400' : 'text-red-400',
                sub: `${pctConc}% de facturas ingreso`,
              },
            ].map(k => (
              <div key={k.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">{k.label}</p>
                <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                {k.sub && <p className="text-xs text-gray-500">{k.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficas de CFDIs */}
      {(cfdiRaw?.length ?? 0) > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-sm">CFDIs por tipo</h2>
            <CfdiTipoChart data={cfdiTipoData} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-sm">Ingreso vs Egreso por mes</h2>
            <CfdiMensualChart data={cfdiMensualData} />
          </div>
        </div>
      )}

      {/* Historial de scores */}
      {(historial?.length ?? 0) > 1 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Evolución del Risk Score</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-px bg-green-500"></span>Bajo ≥80</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-px bg-yellow-500"></span>Medio ≥50</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-px bg-red-500"></span>Alto &lt;50</span>
            </div>
          </div>
          <RiskScoreChart
            data={historial!.map(h => ({
              mes:   new Date(h.periodo).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
              score: Number(h.score),
            }))}
          />
        </div>
      )}

      {/* Alertas recientes */}
      {!isEmpty && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Alertas recientes</h2>
            <Link href="/app/alertas" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver todas →
            </Link>
          </div>

          {(alertas?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">
              {score === null ? 'Ejecuta el análisis para detectar alertas.' : '¡Sin alertas pendientes!'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {alertas!.map(a => (
                <div key={a.id} className={`rounded-xl border px-4 py-3 flex gap-3 items-center ${
                  a.severidad === 'CRITICA' ? 'border-red-500/30 bg-red-500/10' :
                  a.severidad === 'MEDIA'   ? 'border-yellow-500/30 bg-yellow-500/10' :
                  'border-blue-500/30 bg-blue-500/10'
                }`}>
                  <span className={`text-xs font-bold shrink-0 uppercase ${
                    a.severidad === 'CRITICA' ? 'text-red-400' :
                    a.severidad === 'MEDIA'   ? 'text-yellow-400' : 'text-blue-400'
                  }`}>{a.severidad}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white">{TIPO_LABEL[a.tipo_alerta] ?? a.tipo_alerta}</span>
                    <span className="text-xs text-gray-400 truncate">{a.descripcion}</span>
                  </div>
                </div>
              ))}
              {(criticas + medias) > 5 && (
                <Link href="/app/alertas" className="text-xs text-center text-indigo-400 hover:text-indigo-300 py-2">
                  Ver {(criticas + medias) - 5} alertas más →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
