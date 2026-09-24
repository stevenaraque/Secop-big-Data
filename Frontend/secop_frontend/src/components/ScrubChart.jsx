import { useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { useTheme } from "../hooks/useTheme.js";
import { dineroCorto, dineroExacto } from "../lib/formato.js";

// ScrubChart — gráfica con scrub por arrastre (física estilo bencho pull).
// UNA SOLA SERIE ES LA VERDAD: valor = serie[i], cambio = actual - primera.
// El scrub lee la FRACCIÓN de la caja del plot (sin corrección de zoom: píxeles
// sobre píxeles) y cae en una lectura REAL (round, sin interpolar).
// tabular-nums en vez de mono: mismo avance por dígito, nada salta.
// El seguimiento es instantáneo (ES el dedo); el spring solo es el viaje a casa.
const W = 300;
const H = 120;
const PAD = 8;

function puntos(serie) {
  const vals = serie.map((d) => d.valor);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const rango = max - min || 1;
  return serie.map((d, i) => ({
    x: PAD + (i * (W - PAD * 2)) / Math.max(serie.length - 1, 1),
    y: H - PAD - ((d.valor - min) / rango) * (H - PAD * 2),
  }));
}

// Tangentes horizontales: curva suave sin pasarse (look monotone)
function lineaSuave(pts) {
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.01} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function ScrubChart({ data, titulo }) {
  const reduce = useReducedMotion();
  const { dark } = useTheme();
  // Paleta según tema: la tarjeta es blanca en claro y carbón en oscuro
  const C = {
    linea: dark ? "#34d399" : "#059669",
    reticula: dark ? "rgba(255,255,255,0.07)" : "rgba(9,9,11,0.09)",
    cursor: dark ? "rgba(52,211,153,0.45)" : "rgba(5,150,105,0.55)",
    etiqueta: dark ? "rgba(255,255,255,0.4)" : "#71717a",
  };
  const ref = useRef(null);
  const animRef = useRef(null);
  // frac 0..1 = posición del cursor; 1 = en vivo (último). Único estado que manda.
  const [frac, setFrac] = useState(1);
  const [tocando, setTocando] = useState(false);

  const n = data?.length ?? 0;
  // Rangos: con 60+ meses la línea se apelotona. El rango recorta la serie
  // visible (la verdad pasa a ser el slice) y el scrub trabaja sobre él.
  const RANGOS = { "6M": 6, "1A": 12, Todo: Infinity };
  const [rango, setRango] = useState(null);
  const rKey = rango ?? (n > 12 ? "1A" : "Todo");
  const serie = rKey === "Todo" ? (data ?? []) : (data ?? []).slice(-RANGOS[rKey]);
  const m = serie.length;
  if (m === 0) {
    return <p className="text-xs text-zinc-500 dark:text-white/50 mt-2">Sin serie para este filtro.</p>;
  }

  const idx = Math.min(m - 1, Math.max(0, Math.round(frac * (m - 1))));
  // Continuo: el valor es el que hay DEBAJO del cursor, interpolado entre
  // las dos lecturas vecinas. Sin puntos, sin enganches: donde lo pongas, eso mide.
  const xExacta = frac * (m - 1);
  const i0 = Math.min(m - 1, Math.floor(xExacta));
  const i1 = Math.min(m - 1, i0 + 1);
  const t = xExacta - i0;
  const valorCursor = serie[i0].valor + (serie[i1].valor - serie[i0].valor) * t;
  const exacto = t < 0.02;
  // El cursor SE QUEDA donde lo dejas: enVivo solo si está al final.
  // Nada vuelve solo; el spring vive únicamente en el botón "En vivo".
  const enVivo = frac >= 0.999;
  const actual = { label: serie[idx].label, valor: valorCursor };
  const primero = serie[0];
  const cambio = actual.valor - primero.valor;
  const pct = primero.valor ? (cambio / primero.valor) * 100 : 0;
  const sube = cambio >= 0;

  const pts = puntos(serie);
  const dLinea = lineaSuave(pts);
  const dArea = `${dLinea} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  // El cursor viaja continuo: su x sale de la fracción, no de un punto.
  const cursorX = PAD + frac * (W - PAD * 2);

  function leer(e) {
    const r = ref.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  }
  function soltar() {
    setTocando(false);
    // Nada más: el cursor queda clavado donde lo soltaste.
  }
  function volverAlVivo() {
    // Acción explícita del usuario: aquí el spring sí es feedback, no latencia.
    animRef.current?.stop();
    setTocando(false);
    if (reduce) {
      setFrac(1);
      return;
    }
    animRef.current = animate(frac, 1, {
      type: "spring",
      stiffness: 170,
      damping: 26,
      onUpdate: (v) => setFrac(v),
    });
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p title={dineroExacto(actual.valor)} className="font-mono text-[22px] sm:text-[26px] leading-tight font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-white break-words min-w-0" style={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
          {!exacto && !enVivo ? "≈ " : ""}{dineroCorto(actual.valor)}
        </p>
        <span title={dineroExacto(cambio)} className={`shrink-0 text-[11px] font-mono px-2 py-1 rounded-full border tabular-nums ${sube ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-300"}`}>
          {sube ? "+" : ""}{dineroCorto(cambio).replace("$-", "−$")} ({sube ? "+" : ""}{pct.toFixed(1)}%)
        </span>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-white/50 mt-1 tabular-nums flex flex-wrap items-center gap-2">
        <span>{titulo ?? "acumulado mensual"} · {actual.label}{enVivo ? " (en vivo)" : ""}</span>
        {!enVivo && (
          <button
            type="button"
            onClick={volverAlVivo}
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono hover:bg-emerald-500/25 transition-colors"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            En vivo
          </button>
        )}
      </p>

      <div
        ref={ref}
        role="slider"
        aria-label="Explorar serie mensual"
        aria-valuemin={0}
        aria-valuemax={m - 1}
        aria-valuenow={enVivo ? m - 1 : idx}
        aria-valuetext={`${actual.label}: ${actual.valor}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setFrac((f) => Math.max(0, (Math.round(f * (m - 1)) - 1) / (m - 1)));
          if (e.key === "ArrowRight") setFrac((f) => Math.min(1, (Math.round(f * (m - 1)) + 1) / (m - 1)));
          if (e.key === "Home") setFrac(0);
          if (e.key === "End") setFrac(1);
        }}
        onPointerDown={(e) => {
          animRef.current?.stop();
          e.currentTarget.setPointerCapture(e.pointerId);
          setTocando(true);
          setFrac(leer(e));
        }}
        onPointerMove={(e) => {
          if (tocando) setFrac(leer(e));
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="mt-2 h-[168px] cursor-ew-resize touch-pan-y select-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded-xl"
        style={dark ? { filter: "drop-shadow(0 0 14px rgba(16,185,129,0.35))", touchAction: "pan-y" } : { touchAction: "pan-y" }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full block">
          <defs>
            <linearGradient id="gradScrub" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.linea} stopOpacity={0.45} />
              <stop offset="100%" stopColor={C.linea} stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke={C.reticula} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={dArea} fill="url(#gradScrub)" />
          <path d={dLinea} fill="none" stroke={C.linea} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {!enVivo && (
            <line x1={cursorX} x2={cursorX} y1={0} y2={H} stroke={C.cursor} strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-mono text-zinc-500 dark:text-white/40 tabular-nums">
        <span>{serie[0].label}</span>
        <span>{serie[m - 1].label}</span>
      </div>
      {n > 6 && (
        <div role="group" aria-label="Rango de la serie" className="mt-2 flex gap-1">
          {Object.keys(RANGOS).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={rKey === k}
              onClick={() => {
                animRef.current?.stop();
                setTocando(false);
                setRango(k);
                setFrac(1);
              }}
              className={`h-7 px-3 rounded-full text-[11px] font-mono border transition-colors ${rKey === k ? "bg-zinc-900 text-white border-zinc-900 font-semibold dark:bg-white dark:text-black dark:border-white" : "text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:border-zinc-400 dark:text-white/60 dark:border-white/15 dark:hover:text-white dark:hover:border-white/30"}`}
            >
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
