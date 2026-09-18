import { useState, useEffect, useRef, memo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { animate } from "animejs";
import { motion } from "motion/react";
import MapaDirecta from "./MapaDirecta.jsx";
import ProfilerDual from "./ProfilerDual.jsx";
import DataTableSECOP from "./DataTableSECOP.jsx";
import StatusMark from "../components/StatusMark.jsx";

const API = "http://127.0.0.1:8000/api";
async function fetchResumen(d, t) {
  const r = await fetch(`${API}/optimized/resumen/${d ? `?depto=${encodeURIComponent(d)}` : ""}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error();
  return r.json();
}
async function fetchTop(d, t) {
  const r = await fetch(`${API}/optimized/top-contratistas/?limit=5${d ? `&depto=${encodeURIComponent(d)}` : ""}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error();
  return r.json();
}
async function fetchMapa(t) {
  const r = await fetch(`${API}/optimized/mapa-directa/`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error();
  return r.json();
}
async function fetchContratos({ depto }, t) {
  const p = new URLSearchParams({ page: 1, page_size: 20 });
  if (depto) p.set("depto", depto);
  const r = await fetch(`${API}/contratos/?${p}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error();
  return r.json();
}

const KPICard = memo(function KPICard({ label, value, sub, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) animate(ref.current, { opacity: [0, 1], translateY: [16, 0], scale: [0.98, 1], duration: 600, delay, easing: "easeOutExpo" });
  }, [value, delay]);
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 100, damping: 20, delay: delay * 0.001 }} className="group relative rounded-[24px] bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-6 overflow-hidden will-change-transform hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)] hover:scale-[1.01] transition-all duration-300" style={{ contain: "layout paint" }}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-sky-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 rounded-full blur-2xl" />
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-medium relative">{label}</p>
      <p className="text-4xl tracking-tighter font-bold mt-2 tabular-nums relative" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{value}</p>
      <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5 relative">
        <StatusMark status="done" size={14} /> {sub}
      </p>
    </motion.div>
  );
});

export default function DashboardModern({ token }) {
  const [depto, setDepto] = useState("Boyacá");
  const heroRef = useRef(null);
  useEffect(() => {
    if (heroRef.current) animate(heroRef.current.children, { opacity: [0, 1], translateY: [20, 0], delay: (_, i) => i * 80, duration: 700, easing: "easeOutExpo" });
  }, []);

  async function handleLogout() {
    try {
      await fetch(`${API}/auth/logout/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access")}` }, body: JSON.stringify({ refresh: localStorage.getItem("refresh") }) });
    } catch {}
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login";
  }

  const { data: resumen } = useQuery({ queryKey: ["resumen", depto], queryFn: () => fetchResumen(depto, token), enabled: !!token, staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const { data: topData } = useQuery({ queryKey: ["top", depto], queryFn: () => fetchTop(depto, token), enabled: !!token, staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const { data: mapaData } = useQuery({ queryKey: ["mapa"], queryFn: () => fetchMapa(token), enabled: !!token, staleTime: 5 * 60 * 1000 });
  const territorios = [...(mapaData?.mapa || [])].sort((a, b) => String(a.departamento).localeCompare(String(b.departamento), "es"));
  const { data: contratosPag, isFetching, isError: errorTabla } = useQuery({ queryKey: ["contratos", depto], queryFn: () => fetchContratos({ depto }, token), enabled: !!token, staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const rows = contratosPag?.results ?? [];

  if (!token) return <div className="min-h-[100dvh] grid place-items-center bg-[#050505] text-white">Inicia sesión</div>;

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white antialiased selection:bg-emerald-500/30">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap'); *{font-family:Geist,system-ui,sans-serif} .font-mono{font-family:Geist Mono,monospace}`}</style>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(56,189,248,0.12),transparent_60%),radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.08),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <header className="sticky top-0 z-20 backdrop-blur-2xl bg-[#050505]/70 border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 h-[72px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-white text-black grid place-items-center font-bold text-[13px] tracking-tighter">SI</div>
            <div>
              <p className="text-[14px] font-semibold tracking-tight leading-none">SECOP Insight</p>
              <p className="text-[11px] text-white/60 font-mono">6M • 100 FPS • Freemium 2 en 1</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/app" className="h-9 inline-flex items-center rounded-full bg-white text-black px-5 text-xs font-semibold hover:bg-zinc-100 transition-colors will-change-transform hover:scale-[1.02] active:scale-[0.98]">Mis oportunidades →</a>
            <select value={depto} onChange={(e) => setDepto(e.target.value)} className="h-9 rounded-full border border-white/10 bg-white/5 backdrop-blur px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="" className="bg-zinc-900">Todos · Nacional</option>
              {territorios.map((t) => <option key={t.departamento} value={t.departamento} className="bg-zinc-900">{t.departamento} · {t.total}</option>)}
            </select>
            <button onClick={handleLogout} className="h-9 w-9 rounded-full border border-white/10 bg-white/5 grid place-items-center hover:bg-white/10 transition-colors">✕</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8" role="main">
        <section ref={heroRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-[32px] bg-white text-zinc-900 p-8 md:p-10 overflow-hidden relative">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-sky-500/20 rounded-full blur-3xl" />
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-medium">Observatorio público • Boyacá</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-[0.9] mt-3 text-balance" style={{ letterSpacing: "-0.04em" }}>
              6 millones de<br />
              <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">contratos</span> sin<br />
              congelar tu navegador.
            </h1>
            <p className="text-sm text-zinc-600 mt-4 max-w-[50ch] leading-relaxed">Agregamos en PostgreSQL y enviamos 50KB, no 100MB. Virtualizamos a 100 FPS con solo 50 nodos en el DOM.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-mono">100 FPS</span>
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">50KB</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-xs">6M filas</span>
            </div>
          </div>
          <div className="lg:col-span-4 rounded-[32px] bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10" />
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/60 relative">Gráfica en vivo</p>
            <div className="mt-4 h-[160px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={topData?.top?.slice(0, 5) || []}>
                  <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white" }} />
                  <Area type="monotone" dataKey="suma_valor" stroke="#10b981" fill="url(#grad)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-white/60 mt-2 relative">Top contratistas • {topData?.top?.[0]?.contratista_nombre?.slice(0, 20) || "—"} lidera</p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard label="Total contratos" value={resumen?.total ?? 0} sub="COUNT en BD • 100 FPS" delay={0} />
          <KPICard label="Total dinero" value={`$${Number(resumen?.suma_valor || 0).toLocaleString("es-CO")}`} sub="SUM • indexed" delay={80} />
          <KPICard label="Valor promedio" value={`$${Number(resumen?.promedio_valor || 0).toLocaleString("es-CO")}`} sub="AVG • 50KB" delay={160} />
        </section>

        <ProfilerDual token={token} depto={depto} />

        <section className="rounded-[24px] bg-gradient-to-r from-zinc-900 via-black to-zinc-900 border border-white/10 p-[1px]">
          <div className="rounded-[23px] bg-gradient-to-r from-zinc-900 to-black p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                <StatusMark status="running" size={18} /> ¿Alertas de este tipo?
              </h3>
              <p className="text-white/60 text-xs mt-1">Crea un Radar con 85 cols y recibe Matches + email en /app</p>
            </div>
            <a href="/app" className="h-10 inline-flex items-center rounded-full bg-white text-black px-6 text-sm font-semibold hover:bg-zinc-100 transition-all hover:scale-[1.02] active:scale-[0.98]">Crear Radar →</a>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-[24px] bg-white border border-zinc-200 p-6" style={{ contain: "layout paint" }}>
            <h3 className="text-sm font-semibold tracking-tight">Mapa · % directa</h3>
            <p className="text-xs text-zinc-500">Clic filtra todo en sync • 100 FPS</p>
            <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200">
              <MapaDirecta token={token} deptoActivo={depto} onSelectDepto={(n) => setDepto(n)} />
            </div>
          </div>
          <div className="rounded-[24px] bg-white border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold">Top contratistas</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topData?.top || []}>
                <XAxis dataKey="contratista_nombre" hide />
                <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString("es-CO")}`, "Suma"]} />
                <Bar dataKey="suma_valor" radius={[8, 8, 0, 0]} fill="#10b981" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Contratos · DataTable 100 FPS</h2>
            <button
              onClick={async () => {
                const p = new URLSearchParams();
                if (depto) p.set("depto", depto);
                const r = await fetch(`${API}/exportar/?${p}`, { headers: { Authorization: `Bearer ${token}` } });
                if (!r.ok) return;
                const b = await r.blob();
                const u = URL.createObjectURL(b);
                const a = document.createElement("a");
                a.href = u;
                a.download = `contratos${depto ? "-" + depto : ""}.csv`;
                a.click();
                URL.revokeObjectURL(u);
              }}
              className="h-8 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50"
            >
              ⬇ CSV
            </button>
          </div>
          {errorTabla ? (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">No se pudo cargar</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500 border border-dashed rounded-2xl p-8 text-center bg-white">Sin contratos para este filtro</p>
          ) : (
            <DataTableSECOP rows={rows} isFetching={isFetching} count={contratosPag?.count} />
          )}
        </section>

        <section className="grid grid-cols-1 gap-6">
          <Banderas token={token} depto={depto} />
          <PredominioDirecta token={token} depto={depto} />
          <Umbrales token={token} />
          <ActualizacionMasiva token={token} />
          <Entidades token={token} />
          <Grafo token={token} depto={depto} />
        </section>

        <p className="text-[11px] text-white/40 border-t border-white/5 pt-4">Sincronizado: Query cache 5min + 50 nodos + animejs transform/opacity → 100 FPS • Freemium 2 en 1 • 85 cols • 6M sin estallar</p>
      </main>
    </div>
  );
}
