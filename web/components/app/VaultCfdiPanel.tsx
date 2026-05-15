'use client'

import { useRef, useState, useTransition } from 'react'
import { subirEvidencia, eliminarEvidencia, getSignedUrl } from '@/app/app/vault/actions'

type Evidencia = {
  id: string
  cfdi_uuid: string
  nombre: string
  tipo_mime: string
  storage_path: string
  created_at: string
}

type Cfdi = {
  uuid: string
  rfc_emisor: string
  rfc_receptor: string
  fecha_emision: string
  total: number
  concepto?: string | null
  tipo_comprobante: string
}

const CHIP: Record<string, { label: string; cls: string }> = {
  EFOS_DETECTADO:        { label: 'EFOS',         cls: 'bg-red-500/20 text-red-400' },
  MATERIALIDAD_FALTANTE: { label: 'Materialidad',  cls: 'bg-yellow-500/20 text-yellow-400' },
}

export default function VaultCfdiPanel({
  cfdi,
  tiposAlerta,
  evidencias: initialEvidencias,
  autoExpand = false,
}: {
  cfdi: Cfdi
  tiposAlerta: string[]
  evidencias: Evidencia[]
  autoExpand?: boolean
}) {
  const [open, setOpen]           = useState(autoExpand)
  const [evidencias, setEvidencias] = useState(initialEvidencias)
  const [error, setError]         = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const fecha = new Date(cfdi.fecha_emision).toLocaleDateString('es-MX')
  const total = Number(cfdi.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('cfdi_uuid', cfdi.uuid)
    startTransition(async () => {
      const res = await subirEvidencia(fd)
      if (res.error) { setError(res.error); return }
      // Optimistic: reload page data via router — server revalidates
      window.location.reload()
    })
    e.target.value = ''
  }

  function handleDelete(ev: Evidencia) {
    setError(null)
    startTransition(async () => {
      const res = await eliminarEvidencia(ev.id, ev.storage_path)
      if (res.error) { setError(res.error); return }
      setEvidencias(prev => prev.filter(e => e.id !== ev.id))
    })
  }

  async function handleDownload(ev: Evidencia) {
    const res = await getSignedUrl(ev.storage_path)
    if (res.error || !res.url) { setError(res.error ?? 'Error al generar enlace'); return }
    window.open(res.url, '_blank')
  }

  const iconoTipo = (mime: string) => {
    if (mime.includes('pdf')) return '📄'
    if (mime.includes('image')) return '🖼️'
    if (mime.includes('word') || mime.includes('document')) return '📝'
    if (mime.includes('sheet') || mime.includes('excel')) return '📊'
    return '📎'
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-gray-400 truncate">{cfdi.uuid.toUpperCase()}</span>
              {tiposAlerta.map(tipo => {
                const chip = CHIP[tipo]
                if (!chip) return null
                return (
                  <span key={tipo} className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-widest uppercase ${chip.cls}`}>
                    {chip.label}
                  </span>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-300">{cfdi.rfc_emisor}</span>
              <span className="text-gray-600 text-xs">→</span>
              <span className="text-xs text-gray-300">{cfdi.rfc_receptor}</span>
              <span className="text-xs text-gray-500">{fecha}</span>
              <span className="text-xs font-semibold text-white">{total}</span>
            </div>
            {cfdi.concepto && (
              <span className="text-[11px] text-indigo-300 truncate mt-0.5">&ldquo;{cfdi.concepto}&rdquo;</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-gray-500">
            {evidencias.length > 0
              ? `${evidencias.length} archivo${evidencias.length > 1 ? 's' : ''}`
              : 'Sin evidencias'}
          </span>
          <span className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        </div>
      </button>

      {/* Panel expandido */}
      {open && (
        <div className="border-t border-white/10 px-5 py-4 flex flex-col gap-4">
          {/* Lista de archivos */}
          {evidencias.length === 0 ? (
            <p className="text-xs text-gray-500">Sin archivos adjuntos. Sube contratos, cotizaciones o entregables.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {evidencias.map(ev => (
                <div key={ev.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{iconoTipo(ev.tipo_mime)}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{ev.nombre}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(ev.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownload(ev)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      ↓ Ver
                    </button>
                    <button
                      onClick={() => handleDelete(ev)}
                      disabled={pending}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Botón subir */}
          <div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={handleUpload}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-300
                         hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40
                         flex items-center gap-2"
            >
              {pending ? 'Subiendo…' : '↑ Adjuntar archivo'}
            </button>
            <p className="text-[10px] text-gray-600 mt-1.5">PDF, imagen, Word o Excel — máx. 10 MB</p>
          </div>
        </div>
      )}
    </div>
  )
}
