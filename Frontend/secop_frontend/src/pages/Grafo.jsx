import { useState, useMemo, useRef, useEffect } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import ForceGraph2D from "react-force-graph-2d"
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

const formatoCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v ?? 0)

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
    // P1: sin esto cada cambio re-dispara física + flicker. 5min + conserva anterior.
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  })
  // La física NO debe recalentarse en cada render: objeto estable por datos.
  // val = grado del nodo (el hub se ve grande, las hojas chicas).
  const grafica = useMemo(() => {
    const nodes = data?.nodos ?? [];
    const links = data?.aristas ?? [];
    const grado = {};
    links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      grado[s] = (grado[s] ?? 0) + 1;
      grado[t] = (grado[t] ?? 0) + 1;
    });
    return { nodes: nodes.map((n) => ({ ...n, val: grado[n.id] ?? 1 })), links };
  }, [data]);
  // Ancho medido del contenedor: el canvas no hereda ni se auto-mide.
  // Depende de data.total: el marco solo existe cuando hay datos (si corre al montar, ref es null y ancho queda 0).
  const marcoRef = useRef(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = marcoRef.current;
    if (!el) return;
    setAncho(el.clientWidth);
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data?.total]);
  // Fuerzas legibles: repulsión fuerte + links largos (sin esto todo colapsa al centro).
  const fgRef = useRef(null);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !grafica.nodes.length) return;
    try {
      fg.d3Force("charge")?.strength(-220);
      fg.d3Force("link")?.distance(80);
      fg.d3ReheatSimulation?.();
    } catch {
      /* noop: versión de force-graph sin d3Force */
    }
  }, [ancho, grafica]);

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
        Arrastra nodos para moverlos · rueda para zoom · grosor = monto · color = modalidad (rojo directa, verde licitación)
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
          <div ref={marcoRef} className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
            {ancho > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={ancho}
              height={420}
              backgroundColor={dark ? "#09090b" : "#ffffff"}
              graphData={grafica}
              nodeVal={(n) => n.val || 1}
              nodeRelSize={5}
              nodeLabel={(n) => `${n.tipo === "entidad" ? "Entidad" : "Contratista"} · ${n.nombre}`}
              nodeColor={(n) => (n.tipo === "entidad" ? "#059669" : "#2563eb")}
              linkWidth={(l) => l.grosor}
              linkColor={(l) => l.color}
              linkLabel={(l) => `${l.modalidad} · ${formatoCOP(l.monto)}`}
              enableZoomInteraction
              enablePanInteraction
              enableNodeDrag
              cooldownTicks={150}
            />
            )}
          </div>
        </>
      )}
    </section>
  )
}
