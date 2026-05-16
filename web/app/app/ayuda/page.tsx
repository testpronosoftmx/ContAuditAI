'use client'

import React, { useState } from 'react'

const alertDetails = [
  {
    code: 'EFOS_DETECTADO',
    label: 'EFOS Detectado',
    sev: 'CRITICA',
    icon: '🚫',
    metodologia: 'El emisor del CFDI se encuentra en el listado definitivo del SAT (Art. 69-B) como empresa que factura operaciones simuladas.',
    legal: 'Art. 69-B del Código Fiscal de la Federación (CFF)',
    desc: 'Detecta si alguno de tus proveedores está listado por el SAT como "Empresa que Factura Operaciones Simuladas".',
    action: 'Cesar operaciones, no deducir el gasto y recabar pruebas de materialidad para defender la operación ante el SAT.',
    color: 'border-red-500/30 bg-red-500/5'
  },
  {
    code: 'CANCELACION_RETROACTIVA',
    label: 'Cancelación Retroactiva',
    sev: 'CRITICA',
    icon: '❌',
    metodologia: 'Factura que se encuentra vigente en tu contabilidad pero aparece como "Cancelada" en el SAT después de 24 horas de su emisión.',
    legal: 'Art. 29-A del CFF',
    desc: 'Identifica facturas que fueron canceladas después de que el periodo de emisión concluyera, lo cual es un riesgo alto si ya se aplicó la deducción.',
    action: 'Verificar si el proveedor emitió una factura de sustitución o si la cancelación es indebida.',
    color: 'border-red-500/30 bg-red-500/5'
  },
  {
    code: 'PPD_SIN_CRP',
    label: 'PPD sin CRP',
    sev: 'MEDIA',
    icon: '📄',
    metodologia: 'Factura con método de pago PPD que no tiene un Complemento de Pago (CRP) vinculado en el sistema.',
    legal: 'Regla 2.7.1.30 de la RMF 2026',
    desc: 'Facturas emitidas como "Pago en Parcialidades o Diferido" que no cuentan con su Complemento de Recepción de Pagos (CRP) cargado.',
    action: 'Solicitar al proveedor la emisión inmediata del CRP para poder acreditar el IVA.',
    color: 'border-yellow-500/30 bg-yellow-500/5'
  },
  {
    code: 'DISCREPANCIA_BANCARIA',
    label: 'Discrepancia Bancaria',
    sev: 'MEDIA',
    icon: '⚖️',
    metodologia: 'Diferencia mayor a $1.00 entre el monto depositado en banco y el monto neto (Total - Retenciones) del CFDI.',
    legal: 'Art. 27 de la Ley del ISR',
    desc: 'Diferencias entre lo que indica la factura y lo que realmente entró al banco. Puede indicar retenciones no declaradas o errores de captura.',
    action: 'Conciliar la diferencia. Si es una retención, asegurar que esté reflejada en un CRP o en el XML original.',
    color: 'border-yellow-500/30 bg-yellow-500/5'
  },
  {
    code: 'VENTANA_72H',
    label: 'Ventana 72h SAT',
    sev: 'MEDIA',
    icon: '⏱️',
    metodologia: 'La fecha de emisión del CFDI es posterior a las 72 horas reglamentarias después de haber recibido el pago.',
    legal: 'Art. 29 del CFF y Regla 2.7.1.1 RMF',
    desc: 'El SAT exige que el CFDI se expida a más tardar 72 horas después de que se realizó la operación o el pago.',
    action: 'Ajustar procesos administrativos para facturar en tiempo real y evitar multas por emisión tardía.',
    color: 'border-yellow-500/30 bg-yellow-500/5'
  },
  {
    code: 'MATERIALIDAD_FALTANTE',
    label: 'Materialidad Faltante',
    sev: 'MEDIA',
    icon: '🗂️',
    metodologia: 'Operación mayor a $20,000 pesos que no cuenta con archivos de evidencia (contratos, fotos, entregables) en el Vault.',
    legal: 'Art. 49-Bis del CFF',
    desc: 'Operaciones de monto relevante que carecen de soporte documental (contratos, entregables, fotos) que demuestren que el servicio existió.',
    action: 'Subir evidencias al "Materiality Vault" del sistema para blindar la operación ante una auditoría.',
    color: 'border-yellow-500/30 bg-yellow-500/5'
  },
  {
    code: 'INGRESO_NO_FACTURADO',
    label: 'Ingreso no Facturado',
    sev: 'MEDIA',
    icon: '💸',
    metodologia: 'Depósito bancario de ingreso que no se ha podido vincular con ningún CFDI emitido vigente.',
    legal: 'Art. 17 de la Ley del ISR',
    desc: 'Depósitos en el estado de cuenta que no han sido vinculados a ninguna factura emitida.',
    action: 'Emitir el CFDI correspondiente o vincularlo si ya existe. Todo depósito bancario debe tener simetría fiscal.',
    color: 'border-yellow-500/30 bg-yellow-500/5'
  },
  {
    code: 'CONCILIACION_CRUCE_MES',
    label: 'Cruce de Mes (IVA)',
    sev: 'BAJA',
    icon: '📅',
    metodologia: 'La fecha de la factura y la fecha de su cobro/pago efectivo pertenecen a meses de calendario distintos.',
    legal: 'Art. 11 de la Ley del IVA',
    desc: 'Facturas emitidas en un mes pero cobradas/pagadas en otro. Afecta el flujo de IVA acreditable/causado.',
    action: 'Asegurar que el IVA se declare en el mes del flujo de efectivo, no en el de la factura.',
    color: 'border-blue-500/30 bg-blue-500/5'
  },
  {
    code: 'FACTURA_VENCIDA',
    label: 'Factura Vencida',
    sev: 'BAJA',
    icon: '⏳',
    metodologia: 'Factura emitida hace más de 30 días que aún no presenta un registro de pago conciliado en el banco.',
    legal: 'Art. 31 de la Ley del ISR',
    desc: 'Facturas que tienen más de 30 días de antigüedad y no presentan registro de pago en el banco.',
    action: 'Iniciar gestión de cobranza o verificar si el pago fue depositado en una cuenta no fiscal.',
    color: 'border-blue-500/30 bg-blue-500/5'
  },
  {
    code: 'HUERFANO_XML',
    label: 'Factura sin Pago',
    sev: 'BAJA',
    icon: '🔍',
    metodologia: 'Factura emitida en los últimos 30 días que se encuentra pendiente de cobro en el estado de cuenta.',
    legal: 'Art. 29 del CFF',
    desc: 'CFDI emitido recientemente que aún no ha sido conciliado con un movimiento bancario.',
    action: 'Monitorear el ingreso en los próximos días para cerrar la pinza de conciliación.',
    color: 'border-blue-500/30 bg-blue-500/5'
  }
]

function SevBadge({ sev }: { sev: string }) {
  const cls =
    sev === 'CRITICA' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    sev === 'MEDIA'   ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border tracking-widest ${cls}`}>
      {sev}
    </span>
  )
}

export default function AyudaPage() {
  const [activeTab, setActiveTab] = useState('alertas')

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Centro de Ayuda Contable</h1>
        <p className="text-gray-400">Metodología, fundamentos legales y lógica de auditoría de ContAuditAI v11.</p>
      </header>

      <div className="flex gap-10">
        {/* Sidebar Index */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2">Índice de Metodología</p>
            <a href="#variables" className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Variables de Cálculo</a>
            <a href="#scoring" className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Risk Score (0-100)</a>
            <a href="#conciliacion" className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Capas de Conciliación</a>
            
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2 mt-6">Alertas Fiscales</p>
            {alertDetails.map(a => (
              <a 
                key={a.code} 
                href={`#${a.code}`} 
                className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors truncate"
              >
                {a.icon} {a.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-16 pb-20">
          
          {/* Variables Section */}
          <section id="variables" className="scroll-mt-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-indigo-400">#</span> Variables Globales de Cálculo
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: 'v_net (Monto Neto)', val: 'Total - ISR Retenido', desc: 'Monto base que el sistema espera encontrar en el depósito bancario.' },
                { title: 'Match Perfecto', val: '< $1.00', desc: 'Diferencia máxima permitida para considerar una conciliación como exacta.' },
                { title: 'Match Parcial', val: '50% - 99%', desc: 'Rango de cobro para vincular facturas automáticamente con alertas de discrepancia.' },
              ].map(v => (
                <div key={v.title} className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <p className="text-xs text-gray-400 mb-1">{v.title}</p>
                  <p className="text-lg font-mono font-bold text-indigo-400 mb-2">{v.val}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Scoring Section */}
          <section id="scoring" className="scroll-mt-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-indigo-400">#</span> Algoritmo Risk Score
            </h2>
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                  El sistema pondera cada alerta pendiente para calcular tu exposición ante el SAT. Una alerta crítica tiene un impacto 20 veces mayor que una alerta baja en tu calificación.
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-3 h-3 rounded-full bg-red-500" /> Critica: -10 pts
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" /> Media: -2 pts
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-3 h-3 rounded-full bg-blue-500" /> Baja: -0.5 pts
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 border border-white/10 rounded-xl px-6 py-4 font-mono text-center">
                <p className="text-[10px] text-gray-500 uppercase mb-2">Fórmula ContAuditAI</p>
                <p className="text-xl font-bold text-white">100 - (C×10) - (M×2) - (B×0.5)</p>
              </div>
            </div>
          </section>

          {/* Alerts Section */}
          <section id="alertas" className="scroll-mt-24">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
              <span className="text-indigo-400">#</span> Detalle de Alertas Fiscales
            </h2>
            <div className="flex flex-col gap-6">
              {alertDetails.map(a => (
                <div key={a.code} id={a.code} className={`scroll-mt-24 rounded-2xl border ${a.color} p-6 transition-all hover:scale-[1.01]`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{a.icon}</span>
                      <div>
                        <h3 className="text-lg font-bold">{a.label}</h3>
                        <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">{a.legal}</p>
                      </div>
                    </div>
                    <SevBadge sev={a.sev} />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-white/5">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Metodología de Validación</p>
                      <p className="text-sm text-indigo-100 font-medium leading-relaxed bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
                        {a.metodologia}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Acción Recomendada</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{a.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Conciliacion Section */}
          <section id="conciliacion" className="scroll-mt-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-indigo-400">#</span> Capas de Conciliación Bancaria
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: '01', title: 'Firma Digital', desc: 'Match instantáneo si el UUID está presente en el concepto del SPEI o clave de rastreo.', trust: 'ALTA' },
                { n: '02', title: 'Sincronía Fiscal', desc: 'Cruce por RFC + Monto Exacto + Ventana de Tiempo (+/- 45 días).', trust: 'ALTA' },
                { n: '03', title: 'Análisis Parcial', desc: 'Detección de abonos (50-99% del monto). Genera alerta de discrepancia.', trust: 'BAJA' },
              ].map(c => (
                <div key={c.n} className="relative p-6 rounded-2xl border border-white/10 bg-gray-900/50 flex flex-col gap-3">
                  <span className="text-4xl font-black text-white/5 absolute top-4 right-4">{c.n}</span>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{c.title}</h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed flex-1">{c.desc}</p>
                  <div className="mt-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest ${c.trust === 'ALTA' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'}`}>
                      CONFIANZA {c.trust}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-10 pt-10 border-t border-white/5 text-center">
            <p className="text-xs text-gray-600">
              ContAuditAI v11 · Última actualización del motor: 15 de Mayo 2026<br />
              Este manual se actualiza automáticamente con cada cambio en la normativa del SAT.
            </p>
          </footer>

        </div>
      </div>
    </div>
  )
}
