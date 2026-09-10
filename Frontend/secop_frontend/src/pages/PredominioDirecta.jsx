import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

const API = "http://127.0.0.1:8000/api"

async function fetchPredominio(umbral, depto, token) {
  const params = new URLSearchParams({ umbral: String(umbral) })
  if (depto) params.set("depto", depto)
  const r = await fetch(`${API}/predominio-directa/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Error predominio")
  return r.json()
}

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

export default function PredominioDirecta({ token, depto }) {
  const [umbral, setUmbral] = useState(80)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["predominio", umbral, depto],
    queryFn: () => fetchPredominio(umbral, depto, token),
    enabled: !!token,
  })

  return (
    <section aria-label="Predominio contratación directa" className="rounded-2xl border border-amber-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">⚠️ Predominio contratación directa</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Umbral %
          <input
            type="number"
            min={1}
            max={100}
            value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value) || 0)}
            className="w-20 h-9 rounded-lg border border-zinc-200 px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/30"
          />
        </label>
      </div>
      {isLoading && <p className="mt-3 text-xs text-zinc-500">Evaluando predominio…</p>}
      {isError && <p className="mt-3 text-sm text-red-700">Error evaluando predominio. Revisa el umbral (1-100).</p>}
      {!isLoading && !isError && data && data.total === 0 && (
        <p className="mt-3 text-sm text-zinc-600">Sin banderas con umbral {data.umbral}%. Ninguna entidad supera el predominio.</p>
      )}
      {!isLoading && !isError && data && data.total > 0 && (
        <>
          <p className="mt-2 text-xs text-zinc-500 tabular-nums">
            {data.total} alerta{data.total === 1 ? "" : "s"} con umbral {data.umbral}%{depto ? ` en ${depto}` : ""}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-3">Entidad</th>
                  <th className="py-2 pr-3 text-right">% directa</th>
                  <th className="py-2 pr-3 text-right">Directas</th>
                  <th className="py-2 pr-3 text-right">Monto directa</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.banderas.map((b) => (
                  <tr key={b.entidad} className="border-t border-zinc-100">
                    <td className="py-2 pr-3">{b.entidad}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-amber-700 tabular-nums">{b.porcentaje_directa}%</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{b.directas}/{b.total}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatoCOP(b.suma_directa)}</td>
                    <td className="py-2 text-right tabular-nums">{formatoCOP(b.suma_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
