import Image from 'next/image'
import PrintBtn from '@/components/app/PrintBtn'

export const dynamic = 'force-dynamic'

const ALERTAS = [
  {
    id: 'efos',
    tipo: 'EFOS_DETECTADO',
    label: 'EFOS Detectado',
    sev: 'CRITICA' as const,
    marco: 'Art. 69-B CFF',
    porQue: 'El SAT publica periódicamente una lista de empresas que emiten facturas por operaciones inexistentes o simuladas (EFOS). Si tu empresa dedujo gastos con alguno de estos proveedores, esas deducciones son inválidas de pleno derecho.',
    comoSale: 'El motor cruza el RFC de cada emisor en tus CFDIs contra la lista EFOS vigente en la base de datos. Si hay coincidencia, la alerta se dispara independientemente del monto.',
    accion: 'Contacta al proveedor para que acredite la materialidad de la operación. Si no puede, corrige tus declaraciones y cubre el impuesto omitido antes de recibir una Carta Invitación SAT.',
    riesgo: 'Rechazo total de deducciones. Crédito fiscal + actualizaciones + recargos.',
  },
  {
    id: 'cancelacion',
    tipo: 'CANCELACION_RETROACTIVA',
    label: 'Cancelación Retroactiva',
    sev: 'CRITICA' as const,
    marco: 'Art. 29-A CFF · Regla 2.7.1.30 RMF 2026',
    porQue: 'Un CFDI que ya fue pagado (el depósito apareció en el estado de cuenta) fue posteriormente cancelado en el SAT. La cancelación borra el comprobante del ingreso ya cobrado, creando una inconsistencia entre tu contabilidad y el portal SAT.',
    comoSale: 'El motor detecta CFDIs con estado_sat = "Cancelado" cuya fecha de cancelación es posterior a la fecha de emisión y cuyo depósito bancario ya se concilió.',
    accion: 'Emite un nuevo CFDI por el mismo monto y período. Verifica que el receptor haya aceptado la cancelación en el portal SAT.',
    riesgo: 'Ingreso cobrado sin comprobante válido. El SAT puede determinarte un ingreso presunto.',
  },
  {
    id: 'ppd',
    tipo: 'PPD_SIN_CRP',
    label: 'PPD sin Complemento de Pago',
    sev: 'MEDIA' as const,
    marco: 'Regla 2.7.1.30 RMF 2026 · Art. 29 CFF',
    porQue: 'Las facturas con método PPD (Pago en Parcialidades o Diferido) requieren un Complemento de Recepción de Pagos (CRP) por cada pago recibido. Sin el CRP, el IVA del cobro no es acreditable en el mes en que se recibió el dinero.',
    comoSale: 'El motor busca CFDIs tipo Ingreso con metodo_pago = "PPD" que no tienen ningún registro en la tabla cfdi_pagos (donde se guardan los CRPs vinculados). Aplica tanto para facturas emitidas como recibidas por el tenant.',
    accion: 'Si eres el emisor: genera el CRP dentro de los 10 días siguientes al cobro. Si eres el receptor: exige al proveedor que lo emita.',
    riesgo: 'IVA no acreditable. El receptor pierde el derecho a acreditar hasta que el CRP exista.',
  },
  {
    id: 'discrepancia',
    tipo: 'DISCREPANCIA_BANCARIA',
    label: 'Discrepancia Bancaria',
    sev: 'MEDIA' as const,
    marco: 'Art. 27 LISR (simetría fiscal) · Art. 29-A CFF fracc. VII',
    porQue: 'El motor encontró un depósito bancario relacionado con una factura, pero los montos no coinciden exactamente. Hay dos causas: (1) el depósito es $0.01–$5.00 menor (posible retención ISR/IVA no declarada en el XML); (2) el depósito cubre entre 50% y 99% del total (pago parcial genuino con saldo pendiente).',
    comoSale: 'El motor compara el monto neto esperado (total − ISR retenido) contra los depósitos bancarios disponibles en el rango de fechas. Si encuentra un match parcial, registra la conciliación como BAJA y genera esta alerta — visible en el tab "En revisión" de Alertas.',
    accion: 'Retención: solicita CRP que aclare la retención y corrige el XML si aplica. Pago parcial: emite CRP por el abono recibido y gestiona el cobro del saldo pendiente.',
    riesgo: 'Ingreso parcialmente documentado. El SAT puede objetar la deducibilidad del gasto para el receptor.',
  },
  {
    id: 'ventana',
    tipo: 'VENTANA_72H',
    label: 'CFDI Expedido Fuera de Ventana 72h',
    sev: 'MEDIA' as const,
    marco: 'Art. 29 CFF — obligación de expedir CFDI al momento de la operación',
    porQue: 'El SAT exige que la factura se emita al momento en que se percibe el ingreso. Emitirla más de 72 horas después del depósito indica facturación extemporánea, lo que puede poner en riesgo la deducibilidad del gasto para tu cliente.',
    comoSale: 'Para cada conciliación confirmada (ALTA), el motor compara la fecha del CFDI contra la fecha del depósito bancario. Si la diferencia supera 72 horas, se genera la alerta.',
    accion: 'Documenta la causa del retraso. Para futuros casos, activa notificaciones en tu sistema de facturación cuando quede un depósito sin CFDI por más de 24 horas.',
    riesgo: 'Facturación extemporánea observable en auditoría. Puede derivar en multas formales.',
  },
  {
    id: 'materialidad',
    tipo: 'MATERIALIDAD_FALTANTE',
    label: 'Materialidad Faltante',
    sev: 'MEDIA' as const,
    marco: 'Art. 49-Bis CFF (vigente 2026) · Art. 27 fracc. XVIII LISR',
    porQue: 'El Art. 49-Bis CFF (2026) exige que las operaciones amparadas en CFDIs de alto valor estén respaldadas por documentos que demuestren que realmente ocurrieron: contratos, entregables, órdenes de compra, actas de recepción. Sin esto, el SAT puede considerar la operación simulada.',
    comoSale: 'El motor detecta CFDIs de tipo Ingreso con total ≥ al umbral configurado (por defecto $20,000) que no tienen ningún archivo subido en el Vault de Evidencias.',
    accion: 'Sube al Vault los documentos soporte: contrato firmado, comprobante de entrega, correos, fotografías, actas. Mínimo recomendado: contrato + evidencia de entrega.',
    riesgo: 'Operación catalogada como simulada. Rechazo de deducciones para el receptor y posible responsabilidad penal en montos grandes.',
  },
  {
    id: 'ingreso',
    tipo: 'INGRESO_NO_FACTURADO',
    label: 'Ingreso No Facturado',
    sev: 'MEDIA' as const,
    marco: 'Art. 17 LISR (acumulación de ingresos) · Art. 29 CFF',
    porQue: 'Todo ingreso percibido debe estar amparado por un CFDI. El motor encontró depósitos bancarios de tipo Ingreso que no tienen factura correspondiente. Esto puede interpretarse como ingresos omitidos en declaraciones.',
    comoSale: 'Al finalizar la conciliación, los depósitos bancarios que quedaron sin match con ningún CFDI (conciliado = FALSE) generan esta alerta.',
    accion: 'Identifica el origen de cada depósito. Si es una venta, emite el CFDI. Si es un préstamo, aportación o devolución, documéntalo con un contrato o recibo.',
    riesgo: 'Ingresos presuntos. El SAT puede determinar ISR e IVA sobre los montos no facturados más actualizaciones y recargos.',
  },
  {
    id: 'cruce',
    tipo: 'CONCILIACION_CRUCE_MES',
    label: 'Cruce de Mes en Conciliación',
    sev: 'BAJA' as const,
    marco: 'Art. 76 LISR — registros contables por período',
    porQue: 'La factura fue emitida en un mes pero el depósito se recibió en un mes diferente. Esto genera diferencias temporales en el IVA declarado por período y puede crear inconsistencias entre tu contabilidad y los CFDI reportados al SAT.',
    comoSale: 'El motor compara el mes de emisión del CFDI contra el mes del depósito bancario en cada conciliación confirmada.',
    accion: 'Verifica que el IVA del período de facturación esté correctamente declarado. Si la factura es PPD, el IVA se acumula cuando recibes el CRP — confirma que está en el mes correcto.',
    riesgo: 'Diferencias temporales en declaraciones de IVA. Bajo riesgo si las declaraciones anuales cuadran.',
  },
  {
    id: 'huerfano',
    tipo: 'HUERFANO_XML',
    label: 'Factura sin Pago (≤ 30 días)',
    sev: 'BAJA' as const,
    marco: 'Art. 17 LISR — el ingreso se acumula al expedir la factura o al cobrarla',
    porQue: 'Emitiste una factura hace 30 días o menos y el motor no detectó ningún depósito bancario correspondiente. Puede ser que el cliente aún no haya pagado, o que el pago llegó por un canal no registrado (efectivo, cheque, otra cuenta).',
    comoSale: 'CFDIs de tipo Ingreso emitidos por el tenant, con estado_conciliacion = Sin_Conciliar, emitidos hace ≤ 30 días.',
    accion: 'Verifica con el cliente si ya realizó el pago. Si pagó por otro medio, registra el movimiento en el módulo Banco.',
    riesgo: 'Bajo — es una alerta de cobranza temprana. El ingreso ya puede ser acumulable aunque no esté cobrado.',
  },
  {
    id: 'vencida',
    tipo: 'FACTURA_VENCIDA',
    label: 'Factura Vencida (> 30 días)',
    sev: 'BAJA' as const,
    marco: 'Art. 17 LISR · Art. 25 fracc. V LISR (deducción de cuentas incobrables)',
    porQue: 'Factura emitida hace más de 30 días sin cobro detectado. Es una cuenta por cobrar vencida que puede afectar el flujo del negocio. Si supera 30 meses sin cobro, puede declararse como deuda incobrable.',
    comoSale: 'CFDIs de tipo Ingreso emitidos por el tenant, con estado_conciliacion = Sin_Conciliar, emitidos hace > 30 días.',
    accion: 'Inicia proceso formal de cobranza. Si el cliente es insolvente, evalúa la deducción por cuenta incobrable (requiere notificación al deudor y en algunos casos acción mercantil).',
    riesgo: 'Medio a largo plazo. Impacto en ISR por ingresos acumulados no cobrados.',
  },
]

const SEV_CONFIG = {
  CRITICA: { label: 'Crítica', cls: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-500'    },
  MEDIA:   { label: 'Media',   cls: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  BAJA:    { label: 'Baja',    cls: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   dot: 'bg-blue-500'   },
}

const SEV_ORDER: Record<string, number> = { CRITICA: 0, MEDIA: 1, BAJA: 2 }
const sorted = [...ALERTAS].sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev])

export default function AyudaPage() {
  return (
    <div className="flex gap-8 max-w-5xl mx-auto">

      {/* Índice lateral */}
      <aside className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-0 self-start pt-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold px-2 mb-2">Índice</p>
        {sorted.map(a => {
          const s = SEV_CONFIG[a.sev]
          return (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
              {a.label}
            </a>
          )
        })}
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="ContAuditAI" width={36} height={36} className="rounded-lg shrink-0" />
            <div>
              <h1 className="text-2xl font-bold">Manual de Alertas</h1>
              <p className="text-sm text-gray-400 mt-0.5">Por qué sale cada alerta y cómo resolverla</p>
            </div>
          </div>
          <PrintBtn />
        </div>

        {/* Leyenda de severidades */}
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(SEV_CONFIG).map(([key, s]) => (
            <span key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${s.bg} ${s.border} ${s.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          ))}
        </div>

        {/* Alertas */}
        {sorted.map(a => {
          const s = SEV_CONFIG[a.sev]
          return (
            <section
              id={a.id}
              key={a.id}
              className={`rounded-xl border p-5 flex flex-col gap-4 ${s.bg} ${s.border} scroll-mt-4`}
            >
              {/* Título */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${s.bg} ${s.cls} border ${s.border}`}>
                  {s.label}
                </span>
                <h2 className="font-bold text-white text-base">{a.label}</h2>
                <code className="ml-auto text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                  {a.tipo}
                </code>
              </div>

              {/* Marco legal */}
              <div className="flex gap-3 text-xs">
                <span className="text-gray-500 shrink-0 w-28 pt-0.5">Marco legal</span>
                <span className="text-indigo-300">{a.marco}</span>
              </div>

              {/* Grid de info */}
              <div className="grid md:grid-cols-3 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Por qué sale</p>
                  <p className="text-gray-300 leading-relaxed">{a.porQue}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Cómo la detecta el motor</p>
                  <p className="text-gray-400 leading-relaxed">{a.comoSale}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Acción recomendada</p>
                  <p className="text-green-300 leading-relaxed">{a.accion}</p>
                </div>
              </div>

              {/* Riesgo */}
              <div className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 bg-white/5 border border-white/5`}>
                <span className="text-gray-500 shrink-0">Riesgo fiscal:</span>
                <span className={`${s.cls}`}>{a.riesgo}</span>
              </div>
            </section>
          )
        })}

        <p className="text-center text-xs text-gray-600 py-4">
          ContAuditAI · Pre-auditoría fiscal para México · contauditai.pronosoftmx.com
        </p>
      </div>
    </div>
  )
}
