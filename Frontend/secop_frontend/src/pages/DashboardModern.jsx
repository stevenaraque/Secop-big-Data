import { useState, useEffect, useRef, memo, lazy, Suspense } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { animate } from "animejs";
import { motion, useReducedMotion } from "motion/react";
import { Toaster, toast } from "sonner";
import Banderas from "./Banderas.jsx";
import PredominioDirecta from "./PredominioDirecta.jsx";
import Umbrales from "./Umbrales.jsx";
import ActualizacionMasiva from "./ActualizacionMasiva.jsx";
import Entidades from "./Entidades.jsx";
// P2: leaflet (149KB) + force-graph (194KB) fuera del paint inicial. Qué: lazy + Suspense.
const MapaDirecta = lazy(() => import("./MapaDirecta.jsx"));
const Grafo = lazy(() => import("./Grafo.jsx"));
import ProfilerDual from "./ProfilerDual.jsx";
import DataTableSECOP from "./DataTableSECOP.jsx";
import StatusMark from "../components/StatusMark.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import LazySection from "../components/LazySection.jsx";
import PageBackground from "../components/PageBackground.jsx";
import ScrubChart from "../components/ScrubChart.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { dineroCorto, dineroExacto } from "../lib/formato.js";
import { ArrowRight, DownloadSimple as Download, X, Database, CurrencyCircleDollar, TrendUp, MapPin, ChartBar, BellRinging, Lightning, MagnifyingGlass } from "@phosphor-icons/react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"
async function fetchResumen(d, t) {
  const headers = t ? { Authorization: `Bearer ${t}` } : {};
  const r = await fetch(`${API}/optimized/resumen/${d ? `?depto=${encodeURIComponent(d)}` : ""}`, { headers });
  if (!r.ok) throw new Error();
  return r.json();
}
async function fetchTop(d, t) {
  const headers = t ? { Authorization: `Bearer ${t}` } : {};
  const r = await fetch(`${API}/optimized/top-contratistas/?limit=5${d ? `&depto=${encodeURIComponent(d)}` : ""}`, { headers });
  if (!r.ok) throw new Error();
  return r.json();
}
async function fetchMapa(t) {
  const headers = t ? { Authorization: `Bearer ${t}` } : {};
  const r = await fetch(`${API}/optimized/mapa-directa/`, { headers });
  if (!r.ok) throw new Error();
  return r.json();
}
async function fetchContratos({ depto }, t) {
  const p = new URLSearchParams({ page: 1, page_size: 20 });
  if (depto) p.set("depto", depto);
  const headers = t ? { Authorization: `Bearer ${t}` } : {};
  const r = await fetch(`${API}/contratos/?${p}`, { headers });
  if (!r.ok) throw new Error();
  return r.json();
}

// CTA radar estándar: la misma píldora en header, hero y sección CTA.
// Qué: un solo estilo h-10 + motion. Por qué: 3 versiones distintas confundían.
// sobreOscuro: píldora clara para las tarjetas oscuras (CTA radar, gráfica viva).
function EnlaceRadar({ href, children, icono, sobreOscuro }) {
  const colores = sobreOscuro
    ? "bg-white text-black hover:bg-zinc-200"
    : "bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-700 dark:hover:bg-zinc-200";
  return (
    <motion.a
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      href={href}
      className={`h-10 inline-flex items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors ${colores}`}
    >
      {children} {icono ?? <ArrowRight size={16} aria-hidden="true" />}
    </motion.a>
  );
}

const KPICard = memo(function KPICard({ label, value, sub, delay = 0, icon: Icon, loading, title }) {  return (
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ type: "spring", stiffness: 110, damping: 20, delay: delay * 0.001 }} whileHover={{ y: -2 }} className="group relative rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-6 overflow-hidden transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(16,185,129,0.14)]" style={{ contain: "layout paint" }}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-sky-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 rounded-full blur-2xl" />
      <div className="flex items-center justify-between relative">
        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 font-medium">{label}</p>
        {Icon && (
          <span className="size-8 grid place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-2 h-10 w-2/3 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" aria-label="Cargando indicador" />
      ) : (
        <motion.p key={String(value)} title={title} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="text-3xl sm:text-4xl tracking-tighter font-bold mt-2 tabular-nums relative text-zinc-900 dark:text-white break-words leading-[1.05] min-w-0" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", overflowWrap: "anywhere" }}>{value}</motion.p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-1.5 relative">
        <StatusMark status="done" size={14} /> {sub}
      </p>
    </motion.div>
  );
});

async function fetchSerie(depto, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const r = await fetch(`${API}/optimized/serie-mensual/${depto ? `?depto=${encodeURIComponent(depto)}` : ""}`, { headers });
  if (!r.ok) throw new Error();
  return r.json();
}

export default function DashboardModern({ token }) {
  const [depto, setDepto] = useState("Boyacá");
  const [exportando, setExportando] = useState(false);
  const heroRef = useRef(null);
  const reduce = useReducedMotion();
  // Para la píldora del CTA: clara sobre tarjeta oscura y viceversa
  const { dark } = useTheme();
  useEffect(() => {
    if (!heroRef.current || reduce) return;
    const anim = animate(heroRef.current.children, { opacity: [0, 1], translateY: [20, 0], delay: (_, i) => i * 80, duration: 700, easing: "easeOutExpo" });
    return () => anim?.pause?.();
  }, [reduce]);

  async function handleLogout() {
    try {
      await fetch(`${API}/auth/logout/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access")}` }, body: JSON.stringify({ refresh: localStorage.getItem("refresh") }) });
    } catch {}
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login";
  }

  // Público: queries funcionan anonimas (AllowAny) y con JWT; token null => headers vacios
  const { data: resumen, isLoading: cargandoResumen } = useQuery({ queryKey: ["resumen", depto], queryFn: () => fetchResumen(depto, token), staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const { data: topData } = useQuery({ queryKey: ["top", depto], queryFn: () => fetchTop(depto, token), staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const { data: mapaData } = useQuery({ queryKey: ["mapa"], queryFn: () => fetchMapa(token), staleTime: 5 * 60 * 1000 });
  const territorios = [...(mapaData?.mapa || [])].sort((a, b) => String(a.departamento).localeCompare(String(b.departamento), "es"));
  const { data: contratosPag, isFetching, isError: errorTabla } = useQuery({ queryKey: ["contratos", depto], queryFn: () => fetchContratos({ depto }, token), staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const rows = contratosPag?.results ?? [];

  // Serie mensual para el scrub: una sola serie manda (valor, cambio, %)
  const { data: serieData } = useQuery({ queryKey: ["serie", depto], queryFn: () => fetchSerie(depto, token), staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData });
  const serieMensual = (serieData?.serie ?? []).map((s) => ({
    label: String(s.mes ?? "").slice(0, 7),
    valor: Number(s.suma ?? 0),
  }));

  return (
    <div className="relative isolate min-h-[100dvh] bg-[#fcfcfc] dark:bg-[#050505] text-zinc-900 dark:text-white antialiased selection:bg-emerald-500/30 transition-colors duration-300" style={{ fontFamily: "Geist, system-ui, sans-serif" }}>
      <Toaster richColors closeButton position="bottom-left" toastOptions={{ style: { fontFamily: "Geist, system-ui, sans-serif" } }} />
      {/* Fondo compartido: aurora CSS + metal WebGL */}
      <PageBackground />

      <header className="sticky top-0 z-20 backdrop-blur-2xl bg-white/80 dark:bg-[#050505]/70 border-b border-zinc-200 dark:border-white/[0.06] transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 min-h-[72px] py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black grid place-items-center font-bold text-[13px] tracking-tighter">SI</div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold tracking-tight leading-none truncate">SECOP Insight</p>
              <p className="text-[11px] text-zinc-500 dark:text-white/60 font-mono truncate">6M • 100 FPS • Freemium 2 en 1</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {token ? (
              <EnlaceRadar href="/app">Mis oportunidades</EnlaceRadar>
            ) : (
              <EnlaceRadar href="/login">Iniciar sesión</EnlaceRadar>
            )}
            <label htmlFor="filtro-territorio" className="sr-only">Filtrar por territorio</label>
            <select id="filtro-territorio" value={depto} onChange={(e) => setDepto(e.target.value)} className="h-9 max-w-[170px] sm:max-w-[240px] truncate rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur px-4 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Todos · Nacional</option>
              {territorios.map((t) => <option key={t.departamento} value={t.departamento}>{t.departamento} · {t.total}</option>)}
            </select>
            {token ? (
              <button aria-label="Cerrar sesión" onClick={handleLogout} className="h-9 w-9 shrink-0 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 grid place-items-center text-zinc-700 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors"><X size={16} aria-hidden="true" /></button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="contenido" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 w-full min-w-0" role="main" tabIndex={-1}>
        <section ref={heroRef} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
          <div className="lg:col-span-8 rounded-[24px] sm:rounded-[32px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 sm:p-8 md:p-10 overflow-hidden relative min-w-0">
            <motion.div aria-hidden="true" className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-sky-500/20 rounded-full blur-3xl pointer-events-none" animate={reduce ? undefined : { scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Observatorio público • {depto || "Nacional"}
            </p>
            <h1 className="text-[2rem] leading-[1.05] sm:text-4xl md:text-5xl font-bold tracking-tighter sm:leading-[0.95] mt-3 text-balance break-words" style={{ letterSpacing: "-0.04em" }}>
              6 millones de{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">contratos</span>{" "}
              sin congelar tu navegador.
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4 max-w-[50ch] leading-relaxed">Agregamos en PostgreSQL y enviamos 50KB, no 100MB. Virtualizamos a 100 FPS con solo 50 nodos en el DOM.</p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <motion.a whileTap={{ scale: 0.97 }} href="#mapa" className="h-10 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black px-5 text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors">
                <MapPin size={16} aria-hidden="true" /> Explorar mapa
              </motion.a>
              <EnlaceRadar href="/app" icono={<BellRinging size={16} aria-hidden="true" />}>Crear alerta</EnlaceRadar>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono inline-flex items-center gap-1.5"><Lightning size={13} aria-hidden="true" /> 100 FPS</span>
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-xs inline-flex items-center gap-1.5"><Database size={13} aria-hidden="true" /> 50KB</span>
              <span className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5"><ChartBar size={13} aria-hidden="true" /> 6M filas</span>
            </div>
          </div>
          <div className="lg:col-span-4 rounded-[32px] bg-white text-zinc-900 border border-zinc-200 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-black dark:text-white dark:border-white/10 p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10" />
            <div aria-hidden="true" className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 w-[280px] h-[170px] bg-emerald-500/15 blur-[70px] rounded-full pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-white/60 flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </span>
                Gráfica en vivo
              </p>
              <span className="text-[11px] font-mono px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 dark:bg-white/5 dark:border-white/10 dark:text-white/70">Mensual</span>
            </div>
            <div className="mt-3 relative">
              <ScrubChart data={serieMensual} titulo={`serie ${depto || "nacional"}`} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-white/60 mt-2 relative flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 font-mono text-[10px]">SCRUB</span>
              <span className="truncate">arrastra sobre la línea para explorar cada mes</span>
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard label="Total contratos" value={(resumen?.total ?? 0).toLocaleString("es-CO")} sub="COUNT en BD • 100 FPS" delay={0} icon={Database} loading={cargandoResumen && !resumen} />
          <KPICard label="Total dinero" value={dineroCorto(resumen?.suma_valor)} title={dineroExacto(resumen?.suma_valor)} sub="SUM • indexed" delay={80} icon={CurrencyCircleDollar} loading={cargandoResumen && !resumen} />
          <KPICard label="Valor promedio" value={dineroCorto(resumen?.promedio_valor)} title={dineroExacto(resumen?.promedio_valor)} sub="AVG • 50KB" delay={160} icon={TrendUp} loading={cargandoResumen && !resumen} />
        </section>

        {/* Profiler diferido: mide al acercarse (2 queries pesadas menos al abrir) */}
        <LazySection minHeight={180} label="Cargando profiler">
          <ProfilerDual token={token} depto={depto} />
        </LazySection>

        <motion.section whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }} className="rounded-[24px] bg-white border border-zinc-200 dark:bg-gradient-to-r dark:from-zinc-900 dark:via-black dark:to-zinc-900 dark:border-white/10 p-[1px]">
          <div className="rounded-[23px] bg-white dark:bg-gradient-to-r dark:from-zinc-900 dark:to-black p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-zinc-900 dark:text-white font-semibold flex items-center gap-2">
                <StatusMark status="running" size={18} /> ¿Alertas de este tipo?
              </h3>
              <p className="text-zinc-500 dark:text-white/60 text-xs mt-1">Crea un Radar con 85 cols y recibe Matches + email en /app</p>
            </div>
            <EnlaceRadar href="/app" sobreOscuro={dark}>Crear Radar</EnlaceRadar>
          </div>
        </motion.section>

        <section id="mapa" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 scroll-mt-24">
          <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }} className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-4 sm:p-6 min-w-0" style={{ contain: "layout paint" }}>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><MapPin size={15} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> Mapa · % directa</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Clic filtra todo en sync • 100 FPS</p>
            <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 min-w-0">
              <Suspense fallback={<p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">Cargando mapa…</p>}>
                <MapaDirecta token={token} deptoActivo={depto} onSelectDepto={(n) => setDepto(n)} />
              </Suspense>
            </div>
          </motion.div>
          <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }} className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-4 sm:p-6 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><ChartBar size={15} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> Top contratistas</h3>
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-mono">GROUP BY en BD</span>
            </div>
            <div className="w-full min-w-0 overflow-hidden mt-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topData?.top || []}>
                <XAxis dataKey="contratista_nombre" hide />
                <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString("es-CO")}`, "Suma"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="suma_valor" radius={[8, 8, 0, 0]} fill="#10b981" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </motion.div>
        </section>

        <section className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Contratos · DataTable 100 FPS</h2>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={exportando}
              onClick={async () => {
                if (exportando) return;
                setExportando(true);
                const aviso = toast.loading(`Exportando CSV ${depto || "nacional"}…`);
                try {
                  const p = new URLSearchParams();
                  if (depto) p.set("depto", depto);
                  const headers = token ? { Authorization: `Bearer ${token}` } : {};
                  const r = await fetch(`${API}/exportar/?${p}`, { headers });
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  const b = await r.blob();
                  const u = URL.createObjectURL(b);
                  const a = document.createElement("a");
                  a.href = u;
                  a.download = `contratos${depto ? "-" + depto : ""}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(u);
                  toast.success("CSV descargado", { id: aviso });
                } catch {
                  toast.error("No se pudo exportar. Revisa tu sesión.", { id: aviso });
                } finally {
                  setExportando(false);
                }
              }}
              className="h-8 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 text-xs font-medium text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
            >
              <Download size={14} aria-hidden="true" /> {exportando ? "Exportando…" : "CSV"}
            </motion.button>
          </div>
          {errorTabla ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl px-4 py-3">No se pudo cargar</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 text-center bg-white dark:bg-zinc-900 flex items-center justify-center gap-2"><MagnifyingGlass size={16} aria-hidden="true" /> Sin contratos para este filtro — prueba con Todos · Nacional</p>
          ) : (
            <div className="min-w-0 overflow-hidden">
            <DataTableSECOP rows={rows} isFetching={isFetching} count={contratosPag?.count} />
            </div>
          )}
        </section>

        {/* Bajo el fold: cada sección pide su API al hacer scroll, no al abrir.
            Antes eran ~12 queries a la vez contra runserver (1 hilo). */}
        <section className="grid grid-cols-1 gap-4 sm:gap-6 min-w-0">
          <LazySection minHeight={200} label="Cargando banderas">
            <Banderas token={token} depto={depto} />
          </LazySection>
          <LazySection minHeight={200} label="Cargando predominio">
            <PredominioDirecta token={token} depto={depto} />
          </LazySection>
          <LazySection minHeight={160} label="Cargando umbrales">
            <Umbrales token={token} />
          </LazySection>
          <LazySection minHeight={220} label="Cargando actualización">
            <ActualizacionMasiva token={token} />
          </LazySection>
          <LazySection minHeight={200} label="Cargando entidades">
            <Entidades token={token} />
          </LazySection>
          <LazySection minHeight={320} label="Cargando grafo">
            <Suspense fallback={<p className="text-xs text-zinc-500 dark:text-zinc-400">Cargando grafo…</p>}>
              <Grafo token={token} depto={depto} />
            </Suspense>
          </LazySection>
        </section>

        <p className="text-[11px] text-zinc-500 dark:text-white/40 border-t border-zinc-200 dark:border-white/10 pt-4">Sincronizado: Query cache 5min + 50 nodos + animejs transform/opacity → 100 FPS • Freemium 2 en 1 • 85 cols • 6M sin estallar</p>
      </main>
    </div>
  );
}
