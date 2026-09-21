import { useState, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { EnvelopeSimple, ClockClockwise, ShieldCheck, ArrowRight, Lightning, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle.jsx";
import UiverseInput from "../components/UiverseInput.jsx";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function MagneticButton({ children, disabled, className = "", ...props }) {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 180, damping: 18 });
  const sy = useSpring(my, { stiffness: 180, damping: 18 });
  function onMove(e) {
    if (disabled) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.16);
    my.set((e.clientY - (r.top + r.height / 2)) * 0.22);
  }
  function onLeave() { mx.set(0); my.set(0); }
  return (
    <motion.button ref={ref} style={{ x: sx, y: sy }} onMouseMove={onMove} onMouseLeave={onLeave} disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white text-[14px] font-medium h-11 px-6 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.5)] hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${className}`}
      whileTap={disabled ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} {...props}>{children}</motion.button>
  );
}
function LivePulse() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-800 dark:text-emerald-300">
      <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-ping" /><span className="relative rounded-full bg-emerald-500 size-2" /></span>
      Recuperación · 30 min
      <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />1 solo uso
    </span>
  );
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function SolicitarRecuperacion() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado("loading");
    setMensaje("");
    try {
      const r = await fetch(`${API}/auth/recuperar/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detalle || JSON.stringify(data));
      setEstado("ok");
      setMensaje(data.detalle);
    } catch (err) { setEstado("error"); setMensaje(err.message); }
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] dark:bg-zinc-950 relative overflow-hidden flex flex-col">
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 size-[560px] rounded-full bg-emerald-200/25 dark:bg-emerald-900/15 blur-[86px]" />
        <div className="absolute top-[18%] -left-32 size-[620px] rounded-full bg-zinc-200/70 dark:bg-zinc-800/30 blur-[95px]" />
        <div className="absolute bottom-[-80px] right-[28%] size-[420px] rounded-full bg-emerald-100/30 dark:bg-emerald-900/10 blur-[75px]" />
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")` }} />
      </div>
      <header className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center shadow-sm"><span className="font-mono text-[11px] font-bold tracking-tighter text-white dark:text-zinc-900">SI</span></div>
          <div className="leading-none"><div className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</div><div className="text-[11px] tracking-wide text-zinc-500 hidden sm:block">Observatorio · Recuperación</div></div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/login" className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline-offset-4 hover:underline">Volver a login</a>
          <ThemeToggle />
        </div>
      </header>

      <main id="contenido" className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-10 lg:pb-12 grid grid-cols-1 lg:grid-cols-[1.18fr_0.92fr] gap-8 lg:gap-10 items-start lg:items-center">
        <motion.div variants={stagger} initial="hidden" animate="show" className="pt-2 lg:pt-0 lg:pl-[1.5vw] order-2 lg:order-1">
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2"><LivePulse /><span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1 text-[11px] font-medium"><Lightning size={12} weight="fill" /> OWASP · no revela si existe</span></motion.div>
          <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-[52px] lg:text-[56px] font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Recupera<br /><span className="text-zinc-500 dark:text-zinc-400">tu acceso en 30s.</span></motion.h1>
          <motion.p variants={fadeUp} className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-[58ch]">Escribe tu correo. Si existe, enviamos enlace <span className="font-medium text-zinc-900 dark:text-white">30 min, un solo uso</span> con hash SHA-256 + invalidación de previos. En dev revisa la consola del backend.</motion.p>
          <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-4 max-w-[560px]">
            {[
              { icon: ClockClockwise, k: "30 min", label: "ventana", sub: "expira automáticamente" },
              { icon: ShieldCheck, k: "1 uso", label: "quema token", sub: "select_for_update atómico" },
              { icon: EnvelopeSimple, k: "SHA-256", label: "hash en BD", sub: "raw nunca guardado" },
              { icon: Lightning, k: "200 OK", label: "siempre", sub: "no revela existencia" },
            ].map((c) => (
              <div key={c.label} className="rounded-[2rem] border border-slate-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <c.icon size={18} weight="regular" className="text-zinc-900 dark:text-white" />
                <div className="mt-3 font-mono text-[20px] font-semibold tracking-tighter text-zinc-900 dark:text-white leading-none">{c.k}</div>
                <div className="text-[12px] font-medium tracking-tight text-zinc-900 dark:text-white mt-1">{c.label}</div>
                <div className="text-[11px] text-zinc-500">{c.sub}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.18 }} className="order-1 lg:order-2 w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end lg:sticky lg:top-6">
          <div className="rounded-[2.5rem] bg-white/85 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/10 dark:border-zinc-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden">
            <div className="p-8 md:p-9">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Recuperar contraseña</h2><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1">Te enviaremos un enlace si el correo existe.</p></div>
                <div className="size-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center shrink-0"><EnvelopeSimple size={18} weight="fill" className="text-white dark:text-zinc-900" /></div>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
                <UiverseInput id="recuperar-correo" label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" delay={0} />
                <p className="text-[11px] text-zinc-500 -mt-2 px-1">No revelamos si el correo existe (OWASP).</p>

                {estado === "ok" && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 flex gap-2.5"><CheckCircle size={18} weight="fill" className="text-emerald-600 shrink-0 mt-0.5" /><p className="text-sm text-emerald-800 dark:text-emerald-300">{mensaje}</p></motion.div>)}
                {estado === "error" && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex gap-2.5"><WarningCircle size={18} weight="fill" className="text-red-600 shrink-0 mt-0.5" /><p role="alert" className="text-sm text-red-800 dark:text-red-300">{mensaje}</p></motion.div>)}

                <MagneticButton type="submit" disabled={estado === "loading"} className="w-full">
                  {estado === "loading" ? <><span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Enviando…</> : <>Enviar enlace <ArrowRight size={16} weight="bold" /></>}
                </MagneticButton>
              </form>

              <div className="mt-6 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /><span className="text-[11px] tracking-wide text-zinc-500">o</span><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href="/login" className="h-10 rounded-full border border-zinc-200 dark:border-zinc-700 grid place-items-center text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Volver a login</a>
                <a href="/" className="h-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-medium">Ver demo</a>
              </div>
            </div>
            <div className="border-t border-zinc-200/50 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 px-8 py-3 flex items-center justify-between"><span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> 30 min · 1 uso</span><span className="text-[11px] text-zinc-500">console.EmailBackend en dev</span></div>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-500 px-4">Revisa la consola del backend para ver el enlace en dev. En prod llega por SMTP real.</p>
        </motion.div>
      </main>
      <footer className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex items-center justify-between gap-3 text-[11px] text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800 mt-auto"><span>© 2026 SECOP Insight · Recuperación OWASP</span><span>30 min · hash SHA-256</span></footer>
    </div>
  );
}
