'use client'

import { useActionState } from 'react'
import { crearTenant } from '@/app/app/onboarding/actions'

const initialState = { error: '' }

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(crearTenant, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="rfc" className="text-sm font-medium text-gray-300">
          RFC de tu empresa
        </label>
        <input
          id="rfc"
          name="rfc"
          type="text"
          placeholder="XAXX010101000"
          maxLength={13}
          required
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white
                     placeholder-gray-500 text-sm uppercase tracking-widest
                     focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-gray-500">12 caracteres para personas morales, 13 para físicas</p>
      </div>

      {state?.error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white
                   hover:bg-indigo-500 transition-colors disabled:opacity-50 mt-2"
      >
        {pending ? 'Configurando tu empresa...' : 'Comenzar →'}
      </button>
    </form>
  )
}
