'use client'

import { useActionState, useRef, useState } from 'react'
import { subirCFDIs } from '@/app/app/cfdi/actions'

type UploadState = {
  insertados?: number
  omitidos?: number
  errores?: string[]
  error?: string
}

const init: UploadState = {}

export default function CFDIUpload() {
  const [state, action, pending] = useActionState(subirCFDIs, init)
  const inputRef = useRef<HTMLInputElement>(null)
  const [count, setCount]       = useState(0)
  const [dragging, setDragging] = useState(false)

  function setFiles(files: FileList) {
    if (!files.length) return
    const dt = new DataTransfer()
    Array.from(files).forEach(f => dt.items.add(f))
    if (inputRef.current) inputRef.current.files = dt.files
    setCount(files.length)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    setFiles(e.dataTransfer.files)
  }

  return (
    <form action={action}>
      <input
        ref={inputRef}
        type="file"
        name="xmls"
        accept=".xml"
        multiple
        className="hidden"
        onChange={e => setCount(e.target.files?.length ?? 0)}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragEnter={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed p-12 flex flex-col items-center gap-3
                    text-center cursor-pointer transition-colors
                    ${dragging
                      ? 'border-indigo-400 bg-indigo-500/10'
                      : 'border-white/20 hover:border-indigo-500 hover:bg-white/5'}`}
      >
        <span className="text-4xl">{dragging ? '📥' : '📄'}</span>
        {count > 0 ? (
          <p className="font-medium text-indigo-400">{count} archivo{count > 1 ? 's' : ''} seleccionado{count > 1 ? 's' : ''}</p>
        ) : dragging ? (
          <p className="font-medium text-indigo-400">Suelta los archivos aquí</p>
        ) : (
          <>
            <p className="font-medium">Arrastra tus XMLs aquí o haz clic para seleccionar</p>
            <p className="text-sm text-gray-500">Acepta múltiples archivos .xml</p>
          </>
        )}
      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-2">
          {state.error}
        </p>
      )}

      {state.insertados !== undefined && (
        <div className="mt-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 flex flex-col gap-1">
          <p className="text-sm font-medium text-green-400">
            ✓ {state.insertados} CFDI{state.insertados !== 1 ? 's' : ''} importado{state.insertados !== 1 ? 's' : ''}
          </p>
          {(state.omitidos ?? 0) > 0 && (
            <p className="text-xs text-gray-400">{state.omitidos} omitido{state.omitidos !== 1 ? 's' : ''} (ya existían)</p>
          )}
          {(state.errores?.length ?? 0) > 0 && (
            <p className="text-xs text-red-400">{state.errores!.length} con error de parseo</p>
          )}
        </div>
      )}

      {count > 0 && (
        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold
                     hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {pending ? `Importando ${count} archivo${count > 1 ? 's' : ''}...` : `Importar ${count} CFDI${count > 1 ? 's' : ''}`}
        </button>
      )}
    </form>
  )
}
