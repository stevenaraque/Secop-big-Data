import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

const API = "http://127.0.0.1:8000/api"

async function fetchEntidades(q, page, token) {
  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set("q", q)
  const r = await fetch(`${API}/entidades/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(d.detalle || "Error entidades")
  }
  return r.json()
}

async function fetchStats(nit, token) {
  const r = await fetch(`${API}/por-entidad/?nit=${encodeURIComponent(nit)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Error stats")
  return r.json()
}

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

export default function Entidades({ token }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [selNit, setSelNit] = useState(null)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["entidades", q, page],
    queryFn: () => fetchEntidades(q, page, token),
    enabled: !!token,
  })
  const { data: stats } = useQuery({
    queryKey: ["por-entidad", selNit],
    queryFn: () => fetchStats(selNit, token),
    enabled: !!token && !!selNit,
  })

  return (
    <section aria-label="Entidades" className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">🏛️ Entidades</h2>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          placeholder="Buscar por nombre o NIT…"
          className="h-9 w-64 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
        />
      </div>
      {isLoading && <p className="mt-3 text-xs text-zinc-500">Cargando entidades…</p>}
      {isError && <p className="mt-3 text-sm text-red-700">{String(error?.message || "Error cargando entidades.")}</p>}
      {!isLoading && !isError && data && (
        <>
          <p className="mt-2 text-xs text-zinc-500 tabular-nums">{data.count} en total</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">NIT</th>
                  <th className="py-2 pr-3">Depto</th>
                  <th className="py-2 pr-3">Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((e) => (
                  <tr key={e.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3">
                      <button onClick={() => setSelNit(e.nit_entidad)} className="font-medium underline decoration-zinc-300 underline-offset-2 hover:text-emerald-700">
                        {e.nombre_entidad}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 tabular-nums">{e.nit_entidad}</td>
                    <td className="py-2 pr-3 text-zinc-600">{e.departamento}</td>
                    <td className="py-2 text-zinc-600">{e.ciudad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 rounded-lg border border-zinc-200 px-3 disabled:opacity-40">←</button>
            <span className="text-xs text-zinc-500 tabular-nums">Página {page}</span>
            <button disabled={!data.next} onClick={() => setPage(page + 1)} className="h-8 rounded-lg border border-zinc-200 px-3 disabled:opacity-40">→</button>
          </div>
        </>
      )}
      {stats && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-semibold">{stats.entidad?.nombre_entidad} · {stats.total_contratos} contratos · {formatoCOP(stats.total_contratado)}</p>
          {stats.total_contratos === 0 && <p className="mt-1 text-sm text-zinc-600">Sin contratos para esta entidad.</p>}
          {stats.por_modalidad?.length > 0 && (
            <p className="mt-1 text-xs text-zinc-600">
              {stats.por_modalidad.map((m) => `${m.modalidad}: ${m.total}`).join(" · ")}
            </p>
          )}
          {stats.top_contratistas?.length > 0 && (
            <p className="mt-1 text-xs text-zinc-600">
              Top: {stats.top_contratistas.map((t) => `${t.contratista_nombre} (${formatoCOP(t.suma)})`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
