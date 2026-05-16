import Image from 'next/image'
import PrintBtn from '@/components/app/PrintBtn'

export const dynamic = 'force-dynamic'

const ALERTAS = [
  {
    tipo: 'EFOS_DETECTADO',
    label: 'EFOS Detectado',
    sev: 'CRITICA',
    color: 'border-red-500/40 bg-red-500/5',
    badge: 'bg-red-500/20 text-red-400',
    marco: 'Art. 69-B CFF',
    desc: 'Uno o más CFDIs fueron emitidos por un proveedor que aparece en la lista negra del SAT (Empresas que Facturan Operaciones Simuladas). Las deducciones amparadas en estos comprobantes son inválidas y pueden derivar en créditos fiscales.',
    accion: 'Contactar al proveedor para acreditar materialidad. Si no es posible, corregir la declaración y pagar el impuesto omitido antes de que el SAT notifique.',
  },
  {
    tipo: 'CANCELACION_RETROACTIVA',
    label: 'Cancelación Retroactiva',
    sev: 'CRITICA',
    color: 'border-red-500/40 bg-red-500/5',
    badge: 'bg-red-500/20 text-red-400',
    marco: 'Art. 29-A CFF, Regla 2.7.1.30 RMF 2026',
    desc: 'Un CFDI fue cancelado en el SAT después de haberse registrado como pago (el depósito bancario ya se concilió). La cancelación retroactiva invalida el comprobante del ingreso ya cobrado.',
    accion: 'Emitir un nuevo CFDI por el mismo monto y período. Verificar que el receptor haya aceptado la cancelación en el portal SAT.',
  },
  {
    tipo: 'PPD_SIN_CRP',
    label: 'PPD sin Complemento de Pago',
    sev: 'MEDIA',
    color: 'border-yellow-500/40 bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-400',
    marco: 'Regla 2.7.1.30 RMF 2026, Art. 29 CFF',
    desc: 'Existe una factura con método de pago PPD (Pago en Parcialidades o Diferido) sin Complemento de Recepción de Pagos (CRP) correspondiente. Sin el CRP, el IVA del pago recibido no es acreditable en el mes del flujo de efectivo.',
    accion: 'Solicitar al emisor que emita el CRP dentro de los 10 días posteriores al pago. Si el tenant es el emisor, generar el CRP desde el portal del SAT o sistema de facturación.',
  },
  {
    tipo: 'DISCREPANCIA_BANCARIA',
    label: 'Discrepancia Bancaria',
    sev: 'MEDIA',
    color: 'border-yellow-500/40 bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-400',
    marco: 'Art. 27 LISR (simetría fiscal), Art. 29-A CFF fracción VII',
    desc: 'El motor detectó dos variantes: (1) Retención posible — el depósito es $0.01–$5.00 menor al monto esperado, posiblemente por retención ISR/IVA no declarada en el XML. (2) Pago parcial — el depósito cubre entre el 50% y 99% de la factura; el saldo restante está pendiente de cobro.',
    accion: 'Para retenciones: solicitar CRP que aclare la retención y corregir el XML si aplica. Para pagos parciales: emitir CRP por el abono recibido y gestionar cobro del saldo pendiente.',
  },
  {
    tipo: 'VENTANA_72H',
    label: 'CFDI Expedido Fuera de Ventana 72h',
    sev: 'MEDIA',
    color: 'border-yellow-500/40 bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-400',
    marco: 'Art. 29 CFF, Criterio SAT — obligación de expedir CFDI al momento de la operación',
    desc: 'El CFDI fue emitido más de 72 horas después de recibido el depósito bancario. El SAT puede interpretar esto como facturación extemporánea, lo que pone en riesgo la deducibilidad del gasto para el receptor.',
    accion: 'Documentar la causa del retraso. Para futuros casos, configurar alertas de facturación pendiente en el sistema de emisión.',
  },
  {
    tipo: 'MATERIALIDAD_FALTANTE',
    label: 'Materialidad Faltante',
    sev: 'MEDIA',
    color: 'border-yellow-500/40 bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-400',
    marco: 'Art. 49-Bis CFF (vigente 2026), Art. 27 fracc. XVIII LISR',
    desc: 'Factura de $20,000 MXN o más sin evidencia documental que acredite que la operación realmente ocurrió (contratos, entregables, órdenes de compra, actas de entrega). El SAT puede requerir esta evidencia en auditoría.',
    accion: 'Subir al Vault de Evidencias los documentos soporte: contratos, correos, entregas, fotos, actas. Mínimo recomendado: contrato + comprobante de entrega.',
  },
  {
    tipo: 'INGRESO_NO_FACTURADO',
    label: 'Ingreso No Facturado',
    sev: 'MEDIA',
    color: 'border-yellow-500/40 bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-400',
    marco: 'Art. 17 LISR (acumulación de ingresos), Art. 29 CFF',
    desc: 'Se detectó un depósito bancario de tipo Ingreso que no tiene CFDI correspondiente. Todo ingreso percibido debe estar amparado por un comprobante fiscal. La omisión puede derivar en ingresos presuntos determinados por el SAT.',
    accion: 'Identificar el origen del depósito. Si corresponde a una venta, emitir el CFDI con fecha retroactiva dentro del mismo período fiscal. Si es un préstamo o aportación, documentarlo adecuadamente.',
  },
  {
    tipo: 'CONCILIACION_CRUCE_MES',
    label: 'Cruce de Mes en Conciliación',
    sev: 'BAJA',
    color: 'border-blue-500/40 bg-blue-500/5',
    badge: 'bg-blue-500/20 text-blue-400',
    marco: 'Art. 76 LISR (registros contables por período)',
    desc: 'La factura fue emitida en un mes pero el depósito bancario se recibió en un mes diferente. Esto puede generar diferencias temporales en la declaración mensual de IVA y en el acumulado de ingresos del período.',
    accion: 'Verificar que el IVA del mes de facturación coincida con la declaración. Si el pago es PPD, el IVA se acumula al recibir el CRP — asegurarse de emitirlo en el mes correcto.',
  },
  {
    tipo: 'HUERFANO_XML',
    label: 'Factura sin Pago (≤ 30 días)',
    sev: 'BAJA',
    color: 'border-blue-500/40 bg-blue-500/5',
    badge: 'bg-blue-500/20 text-blue-400',
    marco: 'Art. 17 LISR — el ingreso se acumula al expedir la factura o al cobrarla, lo que ocurra primero',
    desc: 'Factura emitida hace 30 días o menos sin depósito bancario correspondiente. El ingreso ya puede ser acumulable aunque no se haya cobrado. Es una señal temprana para gestión de cartera.',
    accion: 'Contactar al cliente para confirmar fecha de pago. Si el pago ya se realizó por otro medio (efectivo, cheque), registrar el movimiento bancario.',
  },
  {
    tipo: 'FACTURA_VENCIDA',
    label: 'Factura Vencida (> 30 días)',
    sev: 'BAJA',
    color: 'border-blue-500/40 bg-blue-500/5',
    badge: 'bg-blue-500/20 text-blue-400',
    marco: 'Art. 17 LISR, Art. 25 fracc. V LISR (deducción de cuentas incobrables)',
    desc: 'Factura emitida hace más de 30 días sin cobro detectado. Representa una cuenta por cobrar vencida. Si supera los 30 meses sin cobro, puede declararse como incobrable y deducirse bajo ciertos requisitos.',
    accion: 'Iniciar proceso formal de cobranza. Si el cliente es insolvente, evaluar si procede la deducción por cuenta incobrable (requiere notificación al deudor y en algunos casos recurso mercantil).',
  },
]

const SEV_ORDER: Record<string, number> = { CRITICA: 0, MEDIA: 1, BAJA: 2 }
const sorted = [...ALERTAS].sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev])

export default function AyudaPage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manual de Alertas</h1>
          <p className="text-sm text-gray-400 mt-1">
            Guía de referencia para interpretar y resolver cada tipo de alerta de riesgo fiscal
          </p>
        </div>
        <PrintBtn />
      </div>

      {/* Portada de impresión — solo visible al imprimir */}
      <div className="hidden print:flex flex-col items-center gap-4 py-8 border-b border-gray-300 mb-4">
        <Image src="/logo.png" alt="ContAuditAI" width={64} height={64} className="rounded-xl" />
        <h1 className="text-3xl font-bold text-gray-900">ContAuditAI</h1>
        <h2 className="text-xl text-gray-600">Manual de Alertas de Riesgo Fiscal</h2>
        <p className="text-sm text-gray-400">Versión 2026 — contauditai.pronosoftmx.com</p>
      </div>

      {/* Resumen de severidades */}
      <div className="grid grid-cols-3 gap-4 print:gap-2">
        {[
          { label: 'Críticas', count: ALERTAS.filter(a => a.sev === 'CRITICA').length, cls: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
          { label: 'Medias',   count: ALERTAS.filter(a => a.sev === 'MEDIA').length,   cls: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
          { label: 'Bajas',    count: ALERTAS.filter(a => a.sev === 'BAJA').length,    cls: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 flex flex-col gap-1 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.count}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Alertas {s.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="flex flex-col gap-4">
        {sorted.map(a => (
          <div key={a.tipo} className={`rounded-xl border p-5 flex flex-col gap-3 ${a.color} print:border-gray-300 print:bg-white print:break-inside-avoid`}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${a.badge} print:border print:border-current`}>
                {a.sev}
              </span>
              <h2 className="font-bold text-white text-sm print:text-gray-900">{a.label}</h2>
              <span className="ml-auto font-mono text-[10px] text-gray-500 print:text-gray-400">{a.tipo}</span>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0 w-20">Marco legal</span>
                <span className="text-indigo-300 print:text-indigo-700">{a.marco}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0 w-20">Descripción</span>
                <span className="text-gray-300 leading-relaxed print:text-gray-700">{a.desc}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0 w-20">Acción</span>
                <span className="text-green-300 leading-relaxed print:text-green-800">{a.accion}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer impresión */}
      <div className="hidden print:block text-center text-xs text-gray-400 pt-4 border-t border-gray-200 mt-4">
        ContAuditAI — Pre-auditoría fiscal para México · contauditai.pronosoftmx.com
      </div>

    </div>
  )
}
