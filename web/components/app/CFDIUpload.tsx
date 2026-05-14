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
  const [count, setCount] = useState(0)

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
        className="rounded-2xl border border-dashed border-white/20 p-12 flex flex-col
                   items-center gap-3 text-center cursor-pointer hover:border-indigo-500
                   hover:bg-white/5 transition-colors"
      >
        <span className="text-4xl">📄</span>
        {count > 0 ? (
          <p className="font-medium text-indigo-400">{count} archivo{count > 1 ? 's' : ''} seleccionado{count > 1 ? 's' : ''}</p>
        ) : (
          <>
            <p className="font-medium">Arrastra tus XMLs aquí</p>
            <p className="text-sm text-gray-500">O haz clic para seleccionar archivos</p>
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
