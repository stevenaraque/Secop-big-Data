import { useState, useEffect } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { CaretLeft as ChevronLeft, CaretRight as ChevronRight, Buildings as Landmark } from "@phosphor-icons/react";
import "../components/glass-card.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

async function fetchEntidades(q, page, token) {
  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set("q", q)
  const r = await fetch(`${API}/entidades/?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(d.detalle || "Error entidades")
  }
  return r.json()
}

async function fetchStats(nit, token) {
  const r = await fetch(`${API}/por-entidad/?nit=${encodeURIComponent(nit)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error("Error stats")
  return r.json()
}

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

export default function Entidades({ token }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  // P1: debounce 300ms — sin esto cada letra dispara 1 request (N+1 por keystroke).
  const [qDeb, setQDeb] = useState("")
  useEffect(() => {
    const t = setTimeout(() => { setQDeb(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const [selNit, setSelNit] = useState(null)
  // P0: key incluye modo (anon/auth) + caché 5min + conserva anterior. Sin esto el login mezcla datos entre modos.
  const modo = token ? "auth" : "anon"
  const { data, isLoading, isError, error, refetch: reintentar } = useQuery({
    queryKey: ["entidades", qDeb, page, modo],
    queryFn: () => fetchEntidades(qDeb, page, token),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  const { data: stats } = useQuery({
    queryKey: ["por-entidad", selNit],
    queryFn: () => fetchStats(selNit, token),
    enabled: !!selNit,
  })

  return (
    <section aria-label="Entidades" className="rounded-[24px] glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Landmark size={18} aria-hidden="true" /> Entidades</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o NIT…"
          className="h-9 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
        />
      </div>
      {isLoading && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Cargando entidades…</p>}
      {isError && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">{String(error?.message || "Error cargando entidades.")}</p>
          <button onClick={() => reintentar()} className="h-8 rounded-full border border-red-300 dark:border-red-800 px-4 text-xs font-medium text-red-700 dark:text-red-300">Reintentar</button>
        </div>
      )}
      {!isLoading && !isError && data && (
        <>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{data.count} en total</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">NIT</th>
                  <th className="py-2 pr-3">Depto</th>
                  <th className="py-2 pr-3">Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((e) => (
                  <tr key={e.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3">
                      <button onClick={() => setSelNit(e.nit_entidad)} className="font-medium underline decoration-zinc-300 underline-offset-2 hover:text-emerald-700">
                        {e.nombre_entidad}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400 tabular-nums">{e.nit_entidad}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{e.departamento}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{e.ciudad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior" className="h-11 w-11 sm:h-8 sm:w-8 grid place-items-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" /></button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">Página {page}</span>
            <button disabled={!data.next} onClick={() => setPage(page + 1)} aria-label="Página siguiente" className="h-11 w-11 sm:h-8 sm:w-8 grid place-items-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 disabled:opacity-40"><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
        </>
      )}
      {stats && (
        <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-4">
          <p className="text-sm font-semibold">{stats.entidad?.nombre_entidad} · {stats.total_contratos} contratos · {formatoCOP(stats.total_contratado)}</p>
          {stats.total_contratos === 0 && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Sin contratos para esta entidad.</p>}
          {stats.por_modalidad?.length > 0 && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {stats.por_modalidad.map((m) => `${m.modalidad}: ${m.total}`).join(" · ")}
            </p>
          )}
          {stats.top_contratistas?.length > 0 && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Top: {stats.top_contratistas.map((t) => `${t.contratista_nombre} (${formatoCOP(t.suma)})`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
