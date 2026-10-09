import { useState, useEffect, useMemo } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ShareNetwork as Network } from "@phosphor-icons/react"
import { useTheme } from "../hooks/useTheme.js";
import "../components/glass-card.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

async function fetchGrafo(limit, depto, token) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (depto) params.set("depto", depto)
  const r = await fetch(`${API}/grafo/?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error("Error grafo")
  return r.json()
}

// Layout bipartito determinista: entidades a la izquierda, contratistas a la
// derecha. Sin física = sin bola de pelos; el hub se lee de un vistazo.
const COL_X = 520
const FILA_H = 84
const corta = (s, n = 30) => {
  const t = String(s ?? "?")
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function aNodos(nodos, tipo, dark) {
  const esEnt = tipo === "entidad"
  return nodos.map((n, i) => ({
    id: n.id,
    type: "default",
    position: { x: esEnt ? 0 : COL_X, y: i * FILA_H },
    data: { label: corta(n.nombre || n.id.slice(2)) },
    style: {
      width: 200,
      background: dark ? "#18181b" : "#ffffff",
      color: dark ? "#f4f4f5" : "#18181b",
      border: `2px solid ${esEnt ? "#059669" : "#2563eb"}`,
      borderRadius: 12,
      fontSize: 11,
      padding: "6px 10px",
    },
  }))
}

export default function Grafo({ token, depto }) {
  const [limit, setLimit] = useState(30)
  // El canvas NO hereda el tema: fondo explícito blanco/negro según toggle
  const { dark } = useTheme()
  // P0: key incluye modo (anon/auth). Sin esto el login mezcla datos entre modos.
  const modo = token ? "auth" : "anon"
  const { data, isLoading, isError, refetch: reintentar } = useQuery({
    queryKey: ["grafo", limit, depto, modo],
    queryFn: () => fetchGrafo(limit, depto, token),
    enabled: true,
    // P1: 5min + conserva anterior al cambiar filtro.
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  })
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const conteo = useMemo(() => {
    const nodos = data?.nodos ?? []
    const aristas = data?.aristas ?? []
    const grado = {}
    aristas.forEach((a) => {
      grado[a.source] = (grado[a.source] ?? 0) + 1
      grado[a.target] = (grado[a.target] ?? 0) + 1
    })
    return { nodos, aristas, grado }
  }, [data])

  // Reconstruye el diagrama solo cuando cambian los datos (drag local no se pierde).
  useEffect(() => {
    const { nodos, aristas, grado } = conteo
    const porTipo = { entidad: [], contratista: [] }
    nodos.forEach((n) => porTipo[n.tipo === "entidad" ? "entidad" : "contratista"].push(n))
    // Hub primero: los más conectados arriba.
    Object.values(porTipo).forEach((arr) => arr.sort((a, b) => (grado[b.id] ?? 0) - (grado[a.id] ?? 0)))
    setNodes([...aNodos(porTipo.entidad, "entidad", dark), ...aNodos(porTipo.contratista, "contratista", dark)])
    setEdges(
      // Sin label: 50 montos apilados al centro son ilegibles; el grosor ya codifica el monto.
      aristas.map((a, i) => ({
        id: `e${i}`,
        source: a.source,
        target: a.target,
        interactionWidth: 20,
        style: { stroke: a.color || "#6b7280", strokeWidth: Math.min(5, a.grosor || 1) },
      })),
    )
  }, [conteo, dark, setNodes, setEdges])

  return (
    <section aria-label="Grafo de conexiones" className="rounded-[24px] glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Network size={18} aria-hidden="true" /> Grafo entidad-contratista</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Contratos
          <input
            type="number"
            min={5}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.min(200, Math.max(5, Number(e.target.value) || 30)))}
            className="w-20 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Entidades a la izquierda, contratistas a la derecha · arrastra nodos · rueda para zoom · grosor = monto · color = modalidad
      </p>
      {isLoading && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Cargando red…</p>}
      {isError && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">Error cargando el grafo.</p>
          <button onClick={() => reintentar()} className="h-8 rounded-full border border-red-300 dark:border-red-800 px-4 text-xs font-medium text-red-700 dark:text-red-300">Reintentar</button>
        </div>
      )}
      {!isLoading && !isError && data && data.total === 0 && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Sin contratos para este filtro.</p>
      )}
      {!isLoading && !isError && data && data.total > 0 && (
        <>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{data.total} contratos · {data.nodos.length} nodos</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 h-[420px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              colorMode={dark ? "dark" : "light"}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1.25 }}
              minZoom={0.3}
            >
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => (String(n.id).startsWith("E:") ? "#059669" : "#2563eb")}
              />
              <Controls />
              <Background variant="dots" gap={16} size={1} />
            </ReactFlow>
          </div>
        </>
      )}
    </section>
  )
}
