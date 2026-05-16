'use client'

export default function PrintBtn() {
  return (
    <button
      onClick={() => window.print()}
      className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-300
                 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2 print:hidden"
    >
      ↓ Exportar PDF
    </button>
  )
}
