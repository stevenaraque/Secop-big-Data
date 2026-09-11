import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import MapaDirecta from "./MapaDirecta.jsx";
import Buscador from "./Buscador.jsx";
import Banderas from "./Banderas.jsx";
import PredominioDirecta from "./PredominioDirecta.jsx";
import Umbrales from "./Umbrales.jsx";
import Entidades from "./Entidades.jsx";
import Grafo from "./Grafo.jsx";

const API = "http://127.0.0.1:8000/api";

async function fetchResumen(depto, token) {
  const url = depto
    ? `${API}/optimized/resumen/?depto=${encodeURIComponent(depto)}`
    : `${API}/optimized/resumen/`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Error resumen");
  return r.json();
}
async function fetchTop(depto, token) {
  const url = depto
    ? `${API}/optimized/top-contratistas/?limit=5&depto=${encodeURIComponent(depto)}`
    : `${API}/optimized/top-contratistas/?limit=5`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Error top");
  return r.json();
}
async function fetchMapa(token) {
  const r = await fetch(`${API}/optimized/mapa-directa/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Error mapa");
  return r.json();
}
async function fetchContratos({ depto, page }, token) {
  const params = new URLSearchParams({ page, page_size: 20 });
  if (depto) params.set("depto", depto);
  const r = await fetch(`${API}/contratos/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Error contratos");
  return r.json();
}

export default function Dashboard({ token }) {
  const [depto, setDepto] = useState("Boyacá");

  const {
    data: resumen,
    isLoading: cargando,
    isError: errorResumen,
  } = useQuery({
    queryKey: ["resumen", depto],
    queryFn: () => fetchResumen(depto, token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
  const { data: topData, isError: errorTop } = useQuery({
    queryKey: ["top", depto],
    queryFn: () => fetchTop(depto, token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
  // RF-16: opciones del dropdown salen del mapa para que todo clic tenga su option
  const { data: mapaData } = useQuery({
    queryKey: ["mapa"],
    queryFn: () => fetchMapa(token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
  const territorios = [...(mapaData?.mapa || [])].sort((a, b) =>
    String(a.departamento).localeCompare(String(b.departamento), "es"),
  );
  const {
    data: contratosPag,
    isLoading: cargandoTabla,
    isFetching,
    isError: errorTabla,
  } = useQuery({
    queryKey: ["contratos", depto],
    queryFn: () => fetchContratos({ depto, page: 1 }, token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });

  const rows = contratosPag?.results ?? [];
  const parentRef = useRef(null);
  // RNF-07: garantía 60 FPS — virtualizador tanstack react-virtual con estimateSize fijo 44px + overscan 8.
  // count es el total de filas de la página actual (pagination), nunca el dataset completo.
  // Esto evita renders bloqueantes: solo DOM de filas visibles (~8+8 overscan = 16 filas max).
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  if (!token)
    return (
      <div className="max-w-[1200px] mx-auto p-8 text-zinc-600">
        Inicia sesión para ver el dashboard. Guarda tu access en localStorage.
      </div>
    );
  if (cargando)
    return (
      <div className="max-w-[1200px] mx-auto p-8">
        <div className="h-24 animate-pulse bg-zinc-100 rounded-xl" />
      </div>
    );

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] text-zinc-900 antialiased">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200" role="banner">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white grid place-items-center text-[11px] font-semibold tracking-widest" aria-hidden="true">
              SI
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight leading-none">
                SECOP Insight
              </p>
              <p className="text-[11px] text-zinc-600">
                Observatorio contratación · 5.98M
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filtro-territorio" className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              Territorio
            </label>
            <select
              id="filtro-territorio"
              aria-label="Filtrar por territorio"
              value={depto}
              onChange={(e) => setDepto(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 transition-colors hover:border-zinc-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <option value="">Todos · Nacional</option>
              {territorios.map((t) => (
                <option key={t.departamento} value={t.departamento}>
                  {t.departamento} · {t.total}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main id="contenido" className="max-w-[1200px] mx-auto px-6 py-8 space-y-6" role="main" tabIndex={-1}>
        <section aria-label="Encabezado">
          <Buscador token={token} />
          <div className="mt-6">
            <Banderas token={token} depto={depto} />
          </div>
          <div className="mt-6">
            <PredominioDirecta token={token} depto={depto} />
          </div>
          <div className="mt-6">
            <Umbrales token={token} />
          </div>
          <div className="mt-6">
            <Entidades token={token} />
          </div>
          <div className="mt-6">
            <Grafo token={token} depto={depto} />
          </div>
          <h1 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-balance">
            Indicadores clave {depto !== "" ? `· ${depto}` : "· Nacional"}
          </h1>
          <p className="text-sm text-zinc-700 mt-2 max-w-[65ch] leading-relaxed">
            Agregado en PostgreSQL con índices, no en el navegador. Cambia el
            filtro y los KPIs se recalculan con la caché de TanStack Query sin
            consultas duplicadas.
          </p>
          {errorResumen && (
            <p role="alert" aria-live="assertive" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-2">
              No se pudo cargar el resumen. Revisa tu sesión e inténtalo de
              nuevo. Si ves Servicio no disponible, espera y recarga.
            </p>
          )}
        </section>

        <section
          aria-label="Indicadores"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              Total contratos
            </p>
            <p className="text-3xl tracking-tighter font-semibold mt-1 tabular-nums" aria-live="polite">
              {resumen?.total ?? 0}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              COUNT en BD · 50 bytes
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              Total dinero
            </p>
            <p className="text-3xl tracking-tighter font-semibold mt-1 tabular-nums" aria-live="polite">
              ${Number(resumen?.suma_valor || 0).toLocaleString("es-CO")}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              SUM valor_contrato · indexed
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              Valor promedio
            </p>
            <p className="text-3xl tracking-tighter font-semibold mt-1 tabular-nums" aria-live="polite">
              ${Number(resumen?.promedio_valor || 0).toLocaleString("es-CO")}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              AVG · se recalcula al cambiar filtro
            </p>
          </div>
        </section>

        <section
          aria-label="Mapa de contratación directa"
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold tracking-tight">
              Mapa · % contratación directa
            </h2>
            <p className="text-[11px] text-zinc-500">
              Rueda o pellizca para zoom · clic en un territorio filtra todo el
              dashboard
            </p>
          </div>
          <MapaDirecta
            token={token}
            deptoActivo={depto}
            onSelectDepto={(n) => setDepto(n)}
          />
        </section>

        <section
          aria-label="Detalle"
          className="grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          <div className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-tight">
                Top contratistas por monto
              </h2>
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                GROUP BY en BD
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topData?.top || []}>
                <XAxis dataKey="contratista_nombre" hide />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={80}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                />
                <Tooltip
                  formatter={(v) => [
                    `$${Number(v).toLocaleString("es-CO")}`,
                    "Suma",
                  ]}
                />
                <Bar
                  dataKey="suma_valor"
                  radius={[8, 8, 0, 0]}
                  fill="#059669"
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-zinc-500 mt-2 tabular-nums">
              {errorTop
                ? "No se pudo cargar el top. Inténtalo de nuevo."
                : `${topData?.top?.[0]?.contratista_nombre || "—"} lidera con $`}
              {!errorTop &&
                Number(topData?.top?.[0]?.suma_valor || 0).toLocaleString(
                  "es-CO",
                )}
            </p>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                Contratos · tabla virtualizada 60 FPS
              </h2>
              <button
                aria-label="Exportar tabla filtrada a CSV"
                onClick={async () => {
                  const params = new URLSearchParams();
                  if (depto) params.set("depto", depto);
                  const r = await fetch(`${API}/exportar/?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!r.ok) return;
                  const blob = await r.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `contratos${depto ? "-" + depto : ""}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-900 hover:border-zinc-300 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                ⬇ CSV
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1 tabular-nums">
              Solo las filas visibles al DOM. {contratosPag?.count ?? 0} totales
              · página 1 de {Math.ceil((contratosPag?.count || 0) / 20) || 1}{" "}
              {isFetching && "· actualizando..."}
            </p>
            {errorTabla ? (
              <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                No se pudo cargar la tabla. Revisa tu sesión.
              </p>
            ) : rows.length === 0 && !cargandoTabla ? (
              <p className="mt-4 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3">
                Sin contratos para este filtro. Prueba con Todos.
              </p>
            ) : (
              <>
                <div
                  ref={parentRef}
                  role="region"
                  aria-label="Tabla de contratos"
                  tabIndex={0}
                  className="mt-4 h-[260px] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((v) => {
                      const row = rows[v.index];
                      return (
                        <div
                          key={row.id_contrato}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${v.start}px)`,
                          }}
                          className="h-[44px] grid grid-cols-[1.2fr_0.8fr_0.9fr] items-center px-3 border-b border-zinc-200 bg-white text-xs"
                        >
                          <span className="truncate font-medium">
                            {row.id_contrato}
                          </span>
                          <span className="truncate text-zinc-600">
                            {row.contratista_nombre}
                          </span>
                          <span className="text-right font-mono">
                            $
                            {Number(row.valor_contrato).toLocaleString("es-CO")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {cargandoTabla && (
                  <div className="mt-2 h-2 bg-zinc-100 animate-pulse rounded" />
                )}
              </>
            )}
          </div>
        </section>

        <p className="text-[11px] text-zinc-500 border-t border-zinc-200 pt-4">
          Estado sincronizado con TanStack Query cache · cambia Boyacá a Todos y
          vuelve, no hay segunda petición.
        </p>
      </main>
    </div>
  );
}
