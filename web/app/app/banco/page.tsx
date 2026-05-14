export default function BancoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Banco / SPEI</h1>
        <p className="text-sm text-gray-400 mt-1">Importa tu estado de cuenta para conciliar con CFDIs</p>
      </div>
      <div className="rounded-2xl border border-dashed border-white/20 p-12 flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">🏦</span>
        <p className="font-medium">Sube tu estado de cuenta en CSV</p>
        <p className="text-sm text-gray-500">Formato compatible con BBVA, Banorte, HSBC, Santander</p>
        <button className="mt-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors">
          Seleccionar CSV
        </button>
      </div>
    </div>
  )
}
