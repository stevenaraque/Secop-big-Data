import { useMemo, useState } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { Warning as TriangleAlert } from "@phosphor-icons/react"
import MiniDataTable from "../components/MiniDataTable.jsx";
import "../components/glass-card.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

async function fetchPredominio(umbral, depto, token) {
  const params = new URLSearchParams({ umbral: String(umbral) })
  if (depto) params.set("depto", depto)
  const r = await fetch(`${API}/predominio-directa/?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error("Error predominio")
  return r.json()
}

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

const columnHelper = createColumnHelper()

export default function PredominioDirecta({ token, depto }) {
  const [umbral, setUmbral] = useState(80)
  // P0: key incluye modo (anon/auth) + caché 5min + conserva anterior. Sin esto el login mezcla datos entre modos.
  const modo = token ? "auth" : "anon"
  const { data, isLoading, isError, refetch: reintentar } = useQuery({
    queryKey: ["predominio", umbral, depto, modo],
    queryFn: () => fetchPredominio(umbral, depto, token),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // DataTable: 8 filas por página + sorting (antes se pintaban TODAS de golpe)
  const columns = useMemo(() => [
    columnHelper.accessor("entidad", {
      header: "Entidad",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor("porcentaje_directa", {
      header: "% directa",
      meta: { align: "right", width: "110px" },
      cell: (info) => <span className="font-semibold text-amber-700 dark:text-amber-300 tabular-nums">{info.getValue()}%</span>,
    }),
    columnHelper.accessor("directas", {
      header: "Directas",
      meta: { align: "right", width: "110px" },
      cell: (info) => <span className="tabular-nums">{info.getValue()}/{info.row.original.total}</span>,
    }),
    columnHelper.accessor("suma_directa", {
      header: "Monto directa",
      meta: { align: "right", width: "150px" },
      cell: (info) => <span className="tabular-nums">{formatoCOP(info.getValue())}</span>,
    }),
    columnHelper.accessor("suma_total", {
      header: "Total",
      meta: { align: "right", width: "150px" },
      cell: (info) => <span className="tabular-nums">{formatoCOP(info.getValue())}</span>,
    }),
  ], [])

  return (
    <section aria-label="Predominio contratación directa" className="rounded-[24px] glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><TriangleAlert size={18} aria-hidden="true" /> Predominio contratación directa</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Umbral %
          <input
            type="number"
            min={1}
            max={100}
            value={umbral}
            onChange={(e) => setUmbral(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            className="w-20 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/30"
          />
        </label>
      </div>
      {isLoading && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Evaluando predominio…</p>}
      {isError && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">Error evaluando predominio. Revisa el umbral (1-100).</p>
          <button onClick={() => reintentar()} className="h-8 rounded-full border border-red-300 dark:border-red-800 px-4 text-xs font-medium text-red-700 dark:text-red-300">Reintentar</button>
        </div>
      )}
      {!isLoading && !isError && data && data.total === 0 && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Sin banderas con umbral {data.umbral}%. Ninguna entidad supera el predominio.</p>
      )}
      {!isLoading && !isError && data && data.total > 0 && (
        <>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {data.total} alerta{data.total === 1 ? "" : "s"} con umbral {data.umbral}%{depto ? ` en ${depto}` : ""}
          </p>
          <MiniDataTable
            columns={columns}
            data={data.banderas}
            defaultSort={[{ id: "porcentaje_directa", desc: true }]}
            pageSize={8}
            label="Paginación de predominio de contratación directa"
          />
        </>
      )}
    </section>
  )
}
