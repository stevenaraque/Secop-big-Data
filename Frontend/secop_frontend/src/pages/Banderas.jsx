import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Flag } from "@phosphor-icons/react"

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

async function fetchBanderas(umbral, depto, token) {
  const params = new URLSearchParams({ umbral: String(umbral) })
  if (depto) params.set("depto", depto)
  const r = await fetch(`${API}/banderas-concentracion/?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error("Error banderas")
  return r.json()
}

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

export default function Banderas({ token, depto }) {
  const [umbral, setUmbral] = useState(30)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["banderas", umbral, depto],
    queryFn: () => fetchBanderas(umbral, depto, token),
    enabled: true,
  })

  return (
    <section aria-label="Banderas rojas de concentración" className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Flag size={18} aria-hidden="true" /> Banderas rojas de concentración</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Umbral %
          <input
            type="number"
            min={1}
            max={100}
            value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value) || 0)}
            className="w-20 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30"
          />
        </label>
      </div>
      {isLoading && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Evaluando concentración…</p>}
      {isError && <p className="mt-3 text-sm text-red-700 dark:text-red-300">Error evaluando banderas. Revisa el umbral (1-100).</p>}
      {!isLoading && !isError && data && data.total === 0 && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Sin banderas con umbral {data.umbral}%. Ningún contratista supera la concentración.</p>
      )}
      {!isLoading && !isError && data && data.total > 0 && (
        <>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {data.total} alerta{data.total === 1 ? "" : "s"} con umbral {data.umbral}%{depto ? ` en ${depto}` : ""}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 pr-3">Contratista</th>
                  <th className="py-2 pr-3">Entidad</th>
                  <th className="py-2 pr-3 text-right">% concentración</th>
                  <th className="py-2 pr-3 text-right">Monto</th>
                  <th className="py-2 text-right">Contratos</th>
                </tr>
              </thead>
              <tbody>
                {data.banderas.map((b) => (
                  <tr key={`${b.entidad}-${b.contratista_nit}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3">{b.contratista_nombre}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{b.entidad}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-red-700 dark:text-red-300 tabular-nums">{b.porcentaje}%</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatoCOP(b.monto)}</td>
                    <td className="py-2 text-right tabular-nums">{b.contratos}</td>
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
