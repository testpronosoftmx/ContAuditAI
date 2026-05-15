'use client'

import { useState, useTransition } from 'react'

type Props = {
  label: string
  confirmText: string
  action: () => Promise<{ error?: string }>
}

export default function ReinicializarBtn({ label, confirmText, action }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  function handleConfirm() {
    start(async () => {
      const res = await action()
      if (res.error) { setError(res.error); setConfirm(false) }
      else { setConfirm(false); setError(null) }
    })
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400">{confirmText}</span>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Borrando...' : 'Sí, reinicializar'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={isPending}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400
                 hover:bg-red-500/10 transition-colors"
    >
      {label}
    </button>
  )
}
