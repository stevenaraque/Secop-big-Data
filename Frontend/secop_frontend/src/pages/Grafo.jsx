import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ForceGraph2D from "react-force-graph-2d"

const API = "http://127.0.0.1:8000/api"

async function fetchGrafo(limit, depto, token) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (depto) params.set("depto", depto)
  const r = await fetch(`${API}/grafo/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Error grafo")
  return r.json()
}

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

export default function Grafo({ token, depto }) {
  const [limit, setLimit] = useState(30)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["grafo", limit, depto],
    queryFn: () => fetchGrafo(limit, depto, token),
    enabled: !!token,
  })

  return (
    <section aria-label="Grafo de conexiones" className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">🕸️ Grafo entidad ↔ contratista</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Contratos
          <input
            type="number"
            min={5}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 30)}
            className="w-20 h-9 rounded-lg border border-zinc-200 px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Arrastra nodos para moverlos · rueda para zoom · grosor = monto · color = modalidad (rojo directa, verde licitación)
      </p>
      {isLoading && <p className="mt-3 text-xs text-zinc-500">Cargando red…</p>}
      {isError && <p className="mt-3 text-sm text-red-700">Error cargando el grafo.</p>}
      {!isLoading && !isError && data && data.total === 0 && (
        <p className="mt-3 text-sm text-zinc-600">Sin contratos para este filtro.</p>
      )}
      {!isLoading && !isError && data && data.total > 0 && (
        <>
          <p className="mt-2 text-xs text-zinc-500 tabular-nums">{data.total} contratos · {data.nodos.length} nodos</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200">
            <ForceGraph2D
              height={420}
              graphData={{ nodes: data.nodos, links: data.aristas }}
              nodeLabel={(n) => `${n.tipo === "entidad" ? "🏛️" : "🏢"} ${n.nombre}`}
              nodeColor={(n) => (n.tipo === "entidad" ? "#059669" : "#2563eb")}
              linkWidth={(l) => l.grosor}
              linkColor={(l) => l.color}
              linkLabel={(l) => `${l.modalidad} · ${formatoCOP(l.monto)}`}
              enableZoomInteraction
              enablePanInteraction
              enableNodeDrag
              cooldownTicks={80}
            />
          </div>
        </>
      )}
    </section>
  )
}
