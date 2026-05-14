'use client'

import { useActionState, useRef, useState } from 'react'
import { subirBanco } from '@/app/app/banco/actions'

type BancoState = { insertados?: number; error?: string }
const init: BancoState = {}

const BANCOS = ['BBVA', 'Banorte', 'HSBC', 'Santander', 'Banamex', 'Scotiabank', 'Otro']

export default function BancoUpload() {
  const [state, action, pending] = useActionState(subirBanco, init)
  const inputRef = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* CLABE + Banco */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">CLABE (18 dígitos)</label>
          <input
            name="clabe"
            type="text"
            maxLength={18}
            placeholder="012345678901234567"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm
                       font-mono text-white placeholder-gray-600 focus:outline-none
                       focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Banco</label>
          <select
            name="banco"
            className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm
                       text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">— Selecciona —</option>
            {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Dropzone */}
      <input
        ref={inputRef}
        type="file"
        name="csv"
        accept=".csv"
        className="hidden"
        onChange={e => setFilename(e.target.files?.[0]?.name ?? '')}
      />
      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border border-dashed border-white/20 p-10 flex flex-col
                   items-center gap-3 text-center cursor-pointer hover:border-indigo-500
                   hover:bg-white/5 transition-colors"
      >
        <span className="text-4xl">🏦</span>
        {filename ? (
          <p className="font-medium text-indigo-400">{filename}</p>
        ) : (
          <>
            <p className="font-medium">Sube tu estado de cuenta en CSV</p>
            <p className="text-sm text-gray-500">Columnas: Fecha, Concepto, Referencia, Cargo, Abono, Saldo</p>
          </>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-2">{state.error}</p>
      )}

      {state.insertados !== undefined && (
        <p className="text-sm font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
          ✓ {state.insertados} movimiento{state.insertados !== 1 ? 's' : ''} importado{state.insertados !== 1 ? 's' : ''}
        </p>
      )}

      {filename && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 py-3 text-sm font-semibold
                     hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {pending ? 'Importando...' : 'Importar estado de cuenta'}
        </button>
      )}
    </form>
  )
}
