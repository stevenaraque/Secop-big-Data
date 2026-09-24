import { useState, useEffect } from "react";
import { motion } from "motion/react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

// Barra fuera del render: crear componentes dentro del render resetea su estado.
function Barra({ label, ms, color, total }) {
  const pct = total ? Math.max(6, (ms / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[58px] text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 font-mono">
        {label}
      </span>
      <div className="flex-1 h-[22px] rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className={`h-full ${color}`}
          style={{ minWidth: ms ? 28 : 0 }}
        />
        <span className="absolute inset-0 grid place-items-center text-[11px] font-mono font-medium text-zinc-900 dark:text-zinc-100">
          {ms} ms
        </span>
      </div>
    </div>
  );
}

// Profiler Dual 4 barras: BD | Python | TTFB | Render + toggle Usuario/Ingeniería
// Design: Telemetry Tactico (mono, scanlines sutiles, 1 acento emerald <80%, DENSITY 8)
// Stack: recharts + motion + mono numbers
export default function ProfilerDual({ token, depto }) {
  const [modo, setModo] = useState("usuario"); // usuario | ingenieria
  const [opt, setOpt] = useState(null);
  const [naive, setNaive] = useState(null);
  const [ttfbOpt, setTtfbOpt] = useState(0);
  const [ttfbNaive, setTtfbNaive] = useState(0);
  const [renderMs, setRenderMs] = useState(0);
  // P0: naive responde 413 con >20k (anti-OOM backend). Qué: estado error. Por qué: sin esto pinta NaN.
  const [error, setError] = useState(null);
  // P1 (24/09): con >20k el naive siempre daría 413 y ensucia la consola.
  // Qué: lee total del optimizado y omite el fetch naive. Por qué: 0 requests inútiles, 0 ruido.
  const [naiveBloqueado, setNaiveBloqueado] = useState(false);

  useEffect(() => {
    // Público: profiler mide anon y con JWT (AllowAny en /optimized/ y /naive/); antes bloqueaba sin token
    let vivo = true;
    const q = depto ? `?depto=${encodeURIComponent(depto)}` : "";

    async function medir(url, setData, setTtfb) {
      const t0 = performance.now();
      const r = await fetch(`${API}${url}${q}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        const e = new Error(`HTTP ${r.status}`);
        e.status = r.status;
        e.url = url;
        throw e;
      }
      const t1 = performance.now();
      const ttfb = Math.round(t1 - t0);
      const j = await r.json();
      if (!vivo) return null;
      setData(j);
      setError(null);
      setTtfb(ttfb || Math.round(j.tiempo_bd_ms + j.tiempo_python_ms + 18));
      return j;
    }

    const tRender0 = performance.now();
    // Secuencial: el total del optimizado decide si el naive vale la pena.
    // Con >20k se omite (el backend daría 413) — sin request, sin 413 en consola.
    (async () => {
      try {
        const optJson = await medir("/optimized/resumen/", setOpt, setTtfbOpt);
        if (!vivo) return;
        if ((optJson?.total ?? 0) > 20000) {
          setNaive(null);
          setNaiveBloqueado(true);
          setError(null);
        } else {
          setNaiveBloqueado(false);
          await medir("/naive/resumen/", setNaive, setTtfbNaive);
        }
      } catch (e) {
        if (vivo) setError(e);
      } finally {
        if (vivo) setRenderMs(Math.round(performance.now() - tRender0));
      }
    })();

    return () => {
      vivo = false;
    };
  }, [token, depto]);

  // P0: error visible en vez de NaN. 413 = naive apagado por tamaño (diseño backend).
  // P1: naiveBloqueado = lo omitimos en el front (ni se pide) — mensaje pedagógico, sin request fallido.
  const errorMsg =
    naiveBloqueado
      ? `Naive omitido por diseño: ${Number(opt?.total ?? 0).toLocaleString("es-CO")} registros > 20k. Traerlos (SELECT *) tumbaría el navegador; el optimizado agrega en BD.`
      : error?.status === 413 && error?.url?.includes("naive")
        ? "Naive deshabilitado con >20k registros (anti-OOM). El optimizado sigue midiendo."
        : error
          ? "No se pudo medir. Revisa tu sesión."
          : null;

  const optBd = opt?.tiempo_bd_ms ?? 0;
  const optPy = opt?.tiempo_python_ms ?? 0;
  const naiveBd = naive?.tiempo_bd_ms ?? 0;
  const naivePy = naive?.tiempo_python_ms ?? 0;

  const totalOpt = Math.round(optBd + optPy + ttfbOpt + renderMs);
  const totalNaive = Math.round(naiveBd + naivePy + ttfbNaive + renderMs);
  const factor = totalNaive && totalOpt ? (totalNaive / totalOpt).toFixed(1) : "—";

  return (
    <section
      aria-label="Profiler dual"
      className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            Profiler dual
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-[11px] font-mono">
              4 capas
            </span>
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-[60ch] leading-relaxed">
            Vista Usuario ve KPIs. Vista Ingeniería desglosa{" "}
            <span className="font-mono">BD | Python | Red | Render</span> en ms.
            Word:9 + Pitch 45s: naive vs optimizado.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Modo profiler"
          className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 p-1"
        >
          <button
            role="tab"
            aria-selected={modo === "usuario"}
            onClick={() => setModo("usuario")}
            className={`h-8 px-4 rounded-full text-xs font-medium transition-colors ${
              modo === "usuario"
                ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100"
            }`}
          >
            Usuario
          </button>
          <button
            role="tab"
            aria-selected={modo === "ingenieria"}
            onClick={() => setModo("ingenieria")}
            className={`h-8 px-4 rounded-full text-xs font-medium transition-colors ${
              modo === "ingenieria"
                ? "bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-800 text-white dark:text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100"
            }`}
          >
            Ingeniería
          </button>
        </div>
      </div>

      {errorMsg && (
        <p role="alert" className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          {errorMsg}
        </p>
      )}

      {modo === "usuario" ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Filtrando <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{depto || "Nacional"}</span> ·{" "}
            {opt ? `${opt.total} contratos` : "cargando..."}
          </p>
          <span className="text-[11px] px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-mono">
            Optimizado {totalOpt} ms
          </span>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Optimizado</p>
                <p className="font-mono text-lg tracking-tighter text-emerald-700 dark:text-emerald-300">{totalOpt} ms</p>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 font-mono">agrega en BD · 50KB</p>
              <div className="mt-3 space-y-2">
                <Barra label="BD" ms={optBd} color="bg-emerald-600" total={totalOpt} />
                <Barra label="Python" ms={optPy} color="bg-amber-500" total={totalOpt} />
                <Barra label="Red" ms={ttfbOpt} color="bg-sky-500" total={totalOpt} />
                <Barra label="Render" ms={renderMs} color="bg-zinc-400" total={totalOpt} />
              </div>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">Naive</p>
                <p className="font-mono text-lg tracking-tighter text-red-700 dark:text-red-300">{naiveBloqueado && !naive ? "—" : `${totalNaive} ms`}</p>
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-300/80 font-mono">SELECT * · 100MB</p>
              {naiveBloqueado && !naive ? (
                <p className="mt-3 text-xs leading-relaxed text-red-800 dark:text-red-200 border border-dashed border-red-300 dark:border-red-800 rounded-xl px-3 py-3">
                  🔒 Omitido por diseño con {Number(opt?.total ?? 0).toLocaleString("es-CO")} registros: traerlos colapsaría RAM/red. Esta es la tesis: agregados, no filas.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <Barra label="BD" ms={naiveBd} color="bg-red-300" total={totalNaive} />
                  <Barra label="Python" ms={naivePy} color="bg-red-600" total={totalNaive} />
                  <Barra label="Red" ms={ttfbNaive} color="bg-sky-300" total={totalNaive} />
                  <Barra label="Render" ms={renderMs} color="bg-zinc-400" total={totalNaive} />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!naiveBloqueado && (
              <span className="px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-800 text-white dark:text-zinc-900 dark:text-zinc-100 font-mono">
                {factor}× más rápido
              </span>
            )}
            <span className="text-zinc-600 dark:text-zinc-400">
              Django agrega (COUNT/SUM) + React virtualiza, no mueve filas. Pitch 45s.
            </span>
            {!opt && <span className="text-zinc-500 dark:text-zinc-400">Midiendo...</span>}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            BD = tiempo query + aggregate · Python = serialización · Red = TTFB fetch · Render = paint React
          </p>
        </div>
      )}
    </section>
  );
}
