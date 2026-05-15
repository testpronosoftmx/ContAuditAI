'use client'

import { useState, useTransition } from 'react'
import { ejecutarAnalisis } from '@/app/app/dashboard/actions'

export default function AnalisisBtn() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    start(async () => {
      const result = await ejecutarAnalisis()
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold
                   hover:bg-indigo-500 transition-colors disabled:opacity-50 shrink-0"
      >
        {pending ? 'Analizando...' : 'Ejecutar análisis'}
      </button>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 max-w-sm text-right">
          {error}
        </p>
      )}
    </div>
  )
}
