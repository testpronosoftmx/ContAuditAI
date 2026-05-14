'use client'

import { useTransition } from 'react'
import { ejecutarAnalisis } from '@/app/app/dashboard/actions'

export default function AnalisisBtn() {
  const [pending, start] = useTransition()

  function handleClick() {
    start(async () => {
      await ejecutarAnalisis()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold
                 hover:bg-indigo-500 transition-colors disabled:opacity-50 shrink-0"
    >
      {pending ? 'Analizando...' : 'Ejecutar análisis'}
    </button>
  )
}
