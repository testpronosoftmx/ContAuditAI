export default function AlertasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Alertas de Riesgo</h1>
        <p className="text-sm text-gray-400 mt-1">Acciones requeridas para reducir tu exposición ante el SAT</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">✅</span>
        <p className="font-medium text-gray-300">Sin alertas activas</p>
        <p className="text-sm text-gray-500">
          El sistema generará alertas automáticas al detectar PPDs sin CRP,
          cancelaciones retroactivas o RFCs en la lista EFOS/EDOS.
        </p>
      </div>
    </div>
  )
}
