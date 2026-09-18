import { useState, useEffect, useRef, memo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { animate } from "animejs";
import MapaDirecta from "./MapaDirecta.jsx";
import Buscador from "./Buscador.jsx";
import Banderas from "./Banderas.jsx";
import PredominioDirecta from "./PredominioDirecta.jsx";
import Umbrales from "./Umbrales.jsx";
import ActualizacionMasiva from "./ActualizacionMasiva.jsx";
import Entidades from "./Entidades.jsx";
import Grafo from "./Grafo.jsx";
import ProfilerDual from "./ProfilerDual.jsx";
import DataTableSECOP from "./DataTableSECOP.jsx";

const API = "http://127.0.0.1:8000/api";

async function fetchResumen(depto, token) {
  const url = depto ? `${API}/optimized/resumen/?depto=${encodeURIComponent(depto)}` : `${API}/optimized/resumen/`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("resumen");
  return r.json();
}
async function fetchTop(depto, token) {
  const url = depto ? `${API}/optimized/top-contratistas/?limit=5&depto=${encodeURIComponent(depto)}` : `${API}/optimized/top-contratistas/?limit=5`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("top");
  return r.json();
}
async function fetchMapa(token) {
  const r = await fetch(`${API}/optimized/mapa-directa/`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("mapa");
  return r.json();
}
async function fetchContratos({ depto, page }, token) {
  const p = new URLSearchParams({ page, page_size: 20 });
  if (depto) p.set("depto", depto);
  const r = await fetch(`${API}/contratos/?${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("contratos");
  return r.json();
}

// Componentes sync memo para 100 FPS
const KPICard = memo(function KPICard({ label, value, sub }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) animate(ref.current, { opacity: [0, 1], translateY: [8, 0], duration: 400, easing: "easeOutQuad" });
  }, [value]);
  return (
    <div ref={ref} className="rounded-2xl border border-zinc-200 bg-white p-5 will-change-transform" style={{ contain: "layout paint" }}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <p className="text-3xl tracking-tighter font-semibold mt-1 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </div>
  );
});

const TopChart = memo(function TopChart({ data }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 will-change-transform" style={{ contain: "layout paint" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-tight">Top contratistas</h3>
        <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">GROUP BY</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data || []}>
          <XAxis dataKey="contratista_nombre" hide />
          <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <Tooltip formatter={(v) => [`$${Number(v).toLocaleString("es-CO")}`, "Suma"]} />
          <Bar dataKey="suma_valor" radius={[8, 8, 0, 0]} fill="#059669" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default function DashboardPublic({ token }) {
  const [depto, setDepto] = useState("Boyacá");
  const kpiRef = useRef(null);

  async function handleLogout() {
    try {
      await fetch(`${API}/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access")}` },
        body: JSON.stringify({ refresh: localStorage.getItem("refresh") }),
      });
    } catch {}
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login";
  }

  const { data: resumen, isLoading: cargando } = useQuery({
    queryKey: ["resumen", depto],
    queryFn: () => fetchResumen(depto, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const { data: topData } = useQuery({ queryKey: ["top", depto], queryFn: () => fetchTop(depto, token), enabled: !!token, staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const { data: mapaData } = useQuery({ queryKey: ["mapa"], queryFn: () => fetchMapa(token), enabled: !!token, staleTime: 5 * 60 * 1000 });
  const territorios = [...(mapaData?.mapa || [])].sort((a, b) => String(a.departamento).localeCompare(String(b.departamento), "es"));
  const { data: contratosPag, isFetching, isError: errorTabla } = useQuery({
    queryKey: ["contratos", depto],
    queryFn: () => fetchContratos({ depto, page: 1 }, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const rows = contratosPag?.results ?? [];

  // 100 FPS: anima KPIs solo con transform/opacity
  useEffect(() => {
    if (kpiRef.current) animate(kpiRef.current.children, { opacity: [0, 1], translateY: [6, 0], delay: (_, i) => i * 40, duration: 350, easing: "easeOutQuad" });
  }, [resumen]);

  if (!token) return <div className="max-w-[1200px] mx-auto p-8 text-zinc-600">Inicia sesión</div>;
  if (cargando && !resumen) return <div className="max-w-[1200px] mx-auto p-8"><div className="h-24 animate-pulse bg-zinc-100 rounded-xl" /></div>;

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] text-zinc-900 antialiased">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200" role="banner">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white grid place-items-center text-[11px] font-mono">SI</div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight">SECOP Insight</p>
              <p className="text-[11px] text-zinc-600">6M • 100 FPS • Freemium</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/app" className="h-9 inline-flex items-center rounded-full bg-zinc-900 text-white px-4 text-xs font-medium hover:bg-zinc-800 will-change-transform">Mis oportunidades →</a>
            <label htmlFor="filtro-territorio" className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">Territorio</label>
            <select id="filtro-territorio" value={depto} onChange={(e) => setDepto(e.target.value)} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
              <option value="">Todos · Nacional</option>
              {territorios.map((t) => <option key={t.departamento} value={t.departamento}>{t.departamento} · {t.total}</option>)}
            </select>
            <button type="button" onClick={handleLogout} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50">Salir</button>
          </div>
        </div>
      </header>

      <main id="contenido" className="max-w-[1200px] mx-auto px-6 py-6 space-y-6" role="main" tabIndex={-1}>
        <section aria-label="Encabezado">
          <Buscador token={token} />
          <div className="mt-6"><Banderas token={token} depto={depto} /></div>
          <div className="mt-6"><PredominioDirecta token={token} depto={depto} /></div>
          <div className="mt-6"><Umbrales token={token} /></div>
          <div className="mt-6"><ActualizacionMasiva token={token} /></div>
          <div className="mt-6"><Entidades token={token} /></div>
          <div className="mt-6"><Grafo token={token} depto={depto} /></div>
          <h1 className="text-3xl md:text-4xl tracking-tighter font-semibold mt-6 text-balance">Indicadores clave · {depto || "Nacional"}</h1>
          <p className="text-sm text-zinc-600 mt-2 max-w-[65ch]">Agregado en PostgreSQL con índices, no en navegador. 100 FPS con virtualización y cache.</p>
        </section>

        <section ref={kpiRef} aria-label="Indicadores" className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ contain: "layout paint" }}>
          <KPICard label="Total contratos" value={resumen?.total ?? 0} sub="COUNT en BD · 50 bytes" />
          <KPICard label="Total dinero" value={`$${Number(resumen?.suma_valor || 0).toLocaleString("es-CO")}`} sub="SUM valor_contrato · indexed" />
          <KPICard label="Valor promedio" value={`$${Number(resumen?.promedio_valor || 0).toLocaleString("es-CO")}`} sub="AVG · 100 FPS" />
        </section>

        <ProfilerDual token={token} depto={depto} />

        <section aria-label="CTA Freemium" className="rounded-2xl border border-zinc-900 bg-zinc-900 p-5 flex flex-wrap items-center justify-between gap-3 will-change-transform">
          <div>
            <h3 className="text-white text-sm font-semibold">¿Alertas de este tipo?</h3>
            <p className="text-zinc-400 text-xs mt-1">Crea un Radar Boyacá + pavimento y recibe Matches + email en /app</p>
          </div>
          <a href="/app" className="h-9 inline-flex items-center rounded-full bg-white text-zinc-900 px-5 text-sm font-medium hover:bg-zinc-100">Crear Radar →</a>
        </section>

        <section aria-label="Mapa" className="rounded-2xl border border-zinc-200 bg-white p-5" style={{ contain: "layout paint" }}>
          <h2 className="text-sm font-semibold">Mapa · % directa</h2>
          <MapaDirecta token={token} deptoActivo={depto} onSelectDepto={(n) => setDepto(n)} />
        </section>

        <section aria-label="Detalle" className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ contain: "layout paint" }}>
          <div className="lg:col-span-3"><TopChart data={topData?.top} /></div>
          <div className="lg:col-span-2">
            <div className="flex justify-end mb-2">
              <button
                aria-label="Exportar CSV"
                onClick={async () => {
                  const p = new URLSearchParams();
                  if (depto) p.set("depto", depto);
                  const r = await fetch(`${API}/exportar/?${p}`, { headers: { Authorization: `Bearer ${token}` } });
                  if (!r.ok) return;
                  const blob = await r.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `contratos${depto ? "-" + depto : ""}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium hover:bg-zinc-50"
              >
                ⬇ CSV
              </button>
            </div>
            {errorTabla ? (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">No se pudo cargar la tabla</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3">Sin contratos</p>
            ) : (
              <DataTableSECOP rows={rows} isFetching={isFetching} count={contratosPag?.count} />
            )}
          </div>
        </section>

        <p className="text-[11px] text-zinc-500 border-t border-zinc-200 pt-4">Sincronizado: Query cache 5min + virtual 50 nodos + animejs transform/opacity → 100 FPS sin estallar con 6M</p>
      </main>
    </div>
  );
}
