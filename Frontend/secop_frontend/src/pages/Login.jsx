import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  ChartBar,
  MagnifyingGlass,
  ArrowRight,
  Eye,
  EyeSlash,
  WarningCircle,
  CheckCircle,
  Buildings,
  ClockClockwise,
  Lightning,
  User,
  EnvelopeSimple,
  Sparkle,
} from "@phosphor-icons/react";
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
      className={`relative inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white text-[14px] font-medium h-11 px-6 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.5)] hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 ${className}`}
      whileTap={disabled ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} {...props}>{children}</motion.button>
  );
}
function LivePulse({ text = "API operativa · 23 ms" }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-800 dark:text-emerald-300">
      <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-ping" /><span className="relative rounded-full bg-emerald-500 size-2" /></span>
      {text}
      <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />SECOP II · sync 47.2s
    </span>
  );
}
function SkeletonBlock() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 mt-4" />
      <div className="h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-11 rounded-full bg-emerald-200/60 dark:bg-emerald-900/30 mt-2" />
    </div>
  );
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function Login() {
  // login state
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");
  const [sesionGuardada, setSesionGuardada] = useState(false);
  const [checked, setChecked] = useState(false);
  // flip + registro state (sin recarga)
  const [flipped, setFlipped] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [correoReg, setCorreoReg] = useState("");
  const [contrasenaReg, setContrasenaReg] = useState("");
  const [confirmarReg, setConfirmarReg] = useState("");
  const [showPassReg, setShowPassReg] = useState(false);
  const [showConfirmReg, setShowConfirmReg] = useState(false);
  const [estadoReg, setEstadoReg] = useState("idle");
  const [mensajeReg, setMensajeReg] = useState("");
  const [fieldErrorsReg, setFieldErrorsReg] = useState({});

  useEffect(() => {
    setSesionGuardada(!!localStorage.getItem("access"));
    setChecked(true);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setEstado("loading"); setMensaje("");
    try {
      const r = await fetch(`${API}/auth/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo, contrasena }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detalle || data.detail || data.error || "No se pudo iniciar sesión.");
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      window.location.href = "/";
    } catch (err) { setEstado("error"); setMensaje(err.message); }
  }
  async function handleRegistro(e) {
    e.preventDefault();
    setMensajeReg(""); setFieldErrorsReg({});
    if (contrasenaReg !== confirmarReg) { setFieldErrorsReg({ confirmar: "Las contraseñas no coinciden." }); setEstadoReg("error"); setMensajeReg("Las contraseñas no coinciden."); return; }
    if (contrasenaReg.length < 8) { setFieldErrorsReg({ contrasena: "La contraseña debe tener al menos 8 caracteres." }); setEstadoReg("error"); setMensajeReg("La contraseña debe tener al menos 8 caracteres."); return; }
    if (!/[A-Z]/.test(contrasenaReg)) { setFieldErrorsReg({ contrasena: "La contraseña debe tener al menos una mayúscula." }); setEstadoReg("error"); setMensajeReg("La contraseña debe tener al menos una mayúscula."); return; }
    if (!/[a-z]/.test(contrasenaReg)) { setFieldErrorsReg({ contrasena: "La contraseña debe tener al menos una minúscula." }); setEstadoReg("error"); setMensajeReg("La contraseña debe tener al menos una minúscula."); return; }
    if (!/[0-9]/.test(contrasenaReg)) { setFieldErrorsReg({ contrasena: "La contraseña debe tener al menos un número." }); setEstadoReg("error"); setMensajeReg("La contraseña debe tener al menos un número."); return; }
    setEstadoReg("loading");
    try {
      const r = await fetch(`${API}/auth/register/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre_usuario: nombreUsuario.trim(), correo: correoReg.trim(), contrasena: contrasenaReg }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const fe = {};
        if (data.correo?.[0]) fe.correo = data.correo[0];
        if (data.email?.[0]) fe.correo = data.email[0];
        if (data.nombre_usuario?.[0]) fe.nombre_usuario = data.nombre_usuario[0];
        if (data.username?.[0]) fe.nombre_usuario = data.username[0];
        if (data.contrasena?.[0]) fe.contrasena = data.contrasena[0];
        if (data.password?.[0]) fe.contrasena = data.password[0];
        if (data.non_field_errors?.[0]) fe._global = data.non_field_errors[0];
        if (data.detalle && !fe._global) fe._global = data.detalle;
        if (data.detail && !fe._global) fe._global = data.detail;
        const detalle = fe._global || fe.correo || fe.nombre_usuario || fe.contrasena || data.detalle || data.detail || JSON.stringify(data).slice(0, 220);
        if (Object.keys(fe).length) setFieldErrorsReg(fe);
        throw new Error(detalle || "No se pudo crear la cuenta.");
      }
      setFieldErrorsReg({}); setEstadoReg("ok"); setMensajeReg("Cuenta creada. Ya puedes entrar y crear tus radares.");
      setTimeout(() => setFlipped(false), 1400);
    } catch (err) { setEstadoReg("error"); setMensajeReg(err.message); }
  }
  function usarOtraCuenta() { localStorage.removeItem("access"); localStorage.removeItem("refresh"); window.location.reload(); }
  function flipToRegistro(e) { e?.preventDefault(); setFlipped(true); }
  function flipToLogin(e) { e?.preventDefault(); setFlipped(false); }

  if (!checked) return <div className="min-h-[100dvh] grid place-items-center bg-[#fcfcfc] dark:bg-zinc-950"><span className="size-6 rounded-full border-2 border-zinc-200 border-t-emerald-600 animate-spin" aria-label="Cargando" /></div>;
  if (sesionGuardada) {
    return (
      <div className="min-h-[100dvh] bg-[#fcfcfc] dark:bg-zinc-950 relative overflow-hidden">
        <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"><div className="absolute -top-32 -right-32 size-[520px] rounded-full bg-emerald-200/30 dark:bg-emerald-900/20 blur-[80px]" /><div className="absolute top-40 -left-40 size-[640px] rounded-full bg-zinc-200/60 dark:bg-zinc-800/40 blur-[90px]" /><div className="absolute bottom-0 right-1/3 size-[360px] rounded-full bg-emerald-100/40 dark:bg-emerald-900/10 blur-[70px]" /></div>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="size-8 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center"><span className="text-white dark:text-zinc-900 font-mono text-[11px] font-bold tracking-tighter">SI</span></div><span className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</span><span className="hidden sm:inline text-[11px] tracking-wide text-zinc-500">· Observatorio SECOP II</span></div>
          <div className="flex items-center gap-2"><button onClick={flipToRegistro} className="hidden sm:inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700">Registrarme</button><ThemeToggle /></div>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 lg:py-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <motion.div variants={stagger} initial="hidden" animate="show" className="pl-0 lg:pl-[2vw]">
            <motion.div variants={fadeUp}><LivePulse /></motion.div>
            <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-6xl font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Ya tienes<br /><span className="text-zinc-500 dark:text-zinc-400">sesión guardada.</span></motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[65ch]">Evita pedir la clave otra vez. Entra directo al dashboard o cambia de cuenta.</motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <a href="/" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-11 px-6 hover:bg-emerald-700">Entrar al dashboard <ArrowRight size={16} weight="bold" /></a>
              <button type="button" onClick={usarOtraCuenta} className="h-11 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6">Usar otra cuenta</button>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.22 }} className="w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end">
            <div className="rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3"><div className="size-9 rounded-full bg-emerald-600 grid place-items-center text-white"><ShieldCheck size={18} weight="fill" /></div><div><div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">Sesión activa</div><div className="text-xs text-zinc-500">Token guardado</div></div><span className="ml-auto size-2 rounded-full bg-emerald-500 animate-pulse" /></div>
              <a href="/" className="mt-6 flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">Entrar al dashboard <ArrowRight size={16} /></a>
              <button type="button" onClick={usarOtraCuenta} className="mt-3 w-full h-11 rounded-full border border-zinc-200 dark:border-zinc-700">Borrar sesión</button>
              <button onClick={flipToRegistro} className="mt-2 w-full h-10 rounded-full border-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 grid place-items-center text-xs font-semibold hover:bg-emerald-600 hover:text-white">Registrar nueva empresa</button>
            </div>
          </motion.div>
        </div>
      </div>
    );
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
          <div className="leading-none"><div className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</div><div className="text-[11px] tracking-wide text-zinc-500 hidden sm:block">Observatorio · Contratación pública SECOP II</div></div>
          <span className="hidden md:inline-flex ml-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 backdrop-blur">v3.1 · Render + Vercel</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={flipped ? flipToLogin : flipToRegistro} className="hidden sm:inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700 active:scale-[0.98] transition-all">
            {flipped ? "Iniciar sesión" : "Registrarme"}
          </button>
          <a href="/" className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 underline-offset-4 hover:underline">Ver observatorio</a>
          <ThemeToggle />
        </div>
      </header>

      <main id="contenido" className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-10 lg:pb-12 grid grid-cols-1 lg:grid-cols-[1.18fr_0.92fr] gap-8 lg:gap-10 items-start lg:items-center">
        {/* LEFT editorial con crossfade suave */}
        <div className="pt-2 lg:pt-0 lg:pl-[1.5vw] order-2 lg:order-1 min-h-[520px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {!flipped ? (
              <motion.div key="login-left" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}>
                <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2"><LivePulse text="API operativa · 23 ms" /><span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1 text-[11px] font-medium"><Lightning size={12} weight="fill" /> Datos abiertos · Datos.gov.co</span></motion.div>
                <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-[52px] lg:text-[56px] font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Contratación<br /><span className="text-zinc-500 dark:text-zinc-400">por fin legible.</span></motion.h1>
                <motion.p variants={fadeUp} className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-[58ch]">Cruza SECOP II con trazabilidad real: entidades, contratistas y modalidad en un solo lugar. Sin jerga, sin humo — <span className="font-medium text-zinc-900 dark:text-white">solo evidencia</span> para veeduría, periodismo y control interno.</motion.p>
                <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-4 max-w-[560px]">
                  {[{ icon: ChartBar, k: "12,847", label: "contratos trazados", sub: "últimos 90 días", accent: "text-emerald-600" },{ icon: Buildings, k: "342", label: "entidades perfiladas", sub: "riesgo por modalidad", accent: "text-zinc-900 dark:text-white" },{ icon: MagnifyingGlass, k: "28", label: "alertas hoy", sub: "directa > umbral", accent: "text-amber-600" },{ icon: ClockClockwise, k: "3.4s", label: "ETL p50", sub: "SODA API · Render", accent: "text-zinc-600" }].map((c) => (
                    <div key={c.label} className="group relative rounded-[2rem] border border-slate-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between"><c.icon size={18} weight="regular" className={c.accent} /><span className="size-1.5 rounded-full bg-emerald-500/70" /></div>
                      <div className="mt-3 font-mono text-[22px] font-semibold tracking-tighter text-zinc-900 dark:text-white leading-none">{c.k}</div>
                      <div className="text-[12px] font-medium tracking-tight text-zinc-900 dark:text-white mt-1">{c.label}</div>
                      <div className="text-[11px] text-zinc-500">{c.sub}</div>
                    </div>
                  ))}
                </motion.div>
                <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500"><span className="inline-flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-emerald-600" /> TLS 1.3 · HSTS</span><span className="size-1 rounded-full bg-zinc-300" /><span>Rate-limit 100/min</span><span className="size-1 rounded-full bg-zinc-300" /><span>JWT + blacklist</span></motion.div>
                <motion.div variants={fadeUp} className="mt-8 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur px-4 py-3 flex gap-3 max-w-[560px]">
                  <div className="size-8 rounded-full bg-zinc-900 dark:bg-white grid place-items-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-white dark:text-zinc-900">“</span></div>
                  <div><div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">Pasamos de Excel disperso a una sola vista. Las banderas por contratación directa nos ahorraron dos semanas de revisión.</div><div className="text-xs text-zinc-500 mt-1.5">Laura Méndez — Oficina Jurídica, Alcaldía intermedia (342 contratos / mes)</div></div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="registro-left" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}>
                <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2"><LivePulse text="Registro abierto · 1.2s" /><span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1 text-[11px] font-medium"><Sparkle size={12} weight="fill" /> Alta en 1.2s · sin papeleo</span></motion.div>
                <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-[52px] lg:text-[56px] font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Crea tu cuenta<br /><span className="text-zinc-500 dark:text-zinc-400">y activa tus radares.</span></motion.h1>
                <motion.p variants={fadeUp} className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-[58ch]">Regístrate en 30 segundos, entra a <span className="font-medium text-zinc-900 dark:text-white">/app</span> y configura notificaciones por palabra clave, ciudad o NIT. Sin validación manual — <span className="font-medium text-zinc-900 dark:text-white">acceso inmediato</span>.</motion.p>
                <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-4 max-w-[560px]">
                  {[{ icon: Buildings, k: "5", label: "radares por usuario", sub: "palabra + filtros_extras" },{ icon: EnvelopeSimple, k: "4", label: "oportunidades/día", sub: "tope anti-spam" },{ icon: Lightning, k: "23ms", label: "latencia API", sub: "JWT HS256 1h/1d" },{ icon: ShieldCheck, k: "PBKDF2", label: "hash seguro", sub: "8+ may/min/número" }].map((c) => (
                    <div key={c.label} className="rounded-[2rem] border border-slate-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between"><c.icon size={18} weight="regular" className="text-zinc-900 dark:text-white" /><span className="size-1.5 rounded-full bg-emerald-500/70" /></div>
                      <div className="mt-3 font-mono text-[20px] font-semibold tracking-tighter text-zinc-900 dark:text-white leading-none">{c.k}</div>
                      <div className="text-[12px] font-medium tracking-tight text-zinc-900 dark:text-white mt-1">{c.label}</div>
                      <div className="text-[11px] text-zinc-500">{c.sub}</div>
                    </div>
                  ))}
                </motion.div>
                <motion.div variants={fadeUp} className="mt-8 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur px-4 py-3 flex gap-3 max-w-[560px]">
                  <div className="size-8 rounded-full bg-zinc-900 dark:bg-white grid place-items-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-white dark:text-zinc-900">“</span></div>
                  <div><div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">Me registré, creé un radar por "pavimento Boyacá" y al día siguiente ya tenía 4 oportunidades filtradas. Cero fricción.</div><div className="text-xs text-zinc-500 mt-1.5">Carlos Rivera — Contratista vial, 12 licitaciones / mes</div></div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT — flip card sin recarga — cross-browser Safari/Firefox/Chrome/Edge */}
        <div className="order-1 lg:order-2 w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end lg:sticky lg:top-6" style={{ perspective: "1200px", WebkitPerspective: "1200px" }}>
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d", willChange: "transform" }}
            className="relative w-full"
          >
            {/* FRONT — Login */}
            <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "translateZ(0)" }} aria-hidden={flipped} className={`w-full ${flipped ? "pointer-events-none" : ""}`}>
              <div className="rounded-[2.5rem] bg-white/85 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/10 dark:border-zinc-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden">
                <div className="p-8 md:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Iniciar sesión</h2><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1 max-w-[28ch]">Entra con tu correo institucional para ver el dashboard privado.</p></div>
                    <div className="size-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center shrink-0"><ShieldCheck size={18} weight="fill" className="text-white dark:text-zinc-900" /></div>
                  </div>
                  {estado === "loading" ? (
                    <div className="mt-7"><SkeletonBlock /><p className="mt-4 text-xs text-zinc-500 flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Verificando credenciales…</p></div>
                  ) : (
                    <form onSubmit={handleLogin} className="mt-7 space-y-4" noValidate>
                      <UiverseInput id="login-correo" label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" delay={0} />
                      <p className="text-[11px] text-zinc-500 -mt-2">Usa el correo con el que te registraste. No compartas tu clave.</p>
                      <UiverseInput id="login-contrasena" label="Contraseña" type={showPass ? "text" : "password"} value={contrasena} onChange={(e) => setContrasena(e.target.value)} placeholder="Tu contraseña" required autoComplete="current-password" icon={showPass ? EyeSlash : Eye} onIconClick={() => setShowPass((v) => !v)} iconLabel={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} delay={80} />
                      <div className="flex justify-end -mt-3"><a href="/recuperar" className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 underline-offset-4 hover:underline">Olvidé mi clave</a></div>
                      {estado === "error" && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex gap-2.5"><WarningCircle size={18} weight="fill" className="text-red-600 shrink-0 mt-0.5" /><p role="alert" className="text-sm leading-relaxed text-red-800 dark:text-red-300">{mensaje}</p></motion.div>)}
                      <div className="pt-1"><MagneticButton type="submit" disabled={estado === "loading"} className="w-full">Entrar <ArrowRight size={16} weight="bold" /></MagneticButton><p className="mt-2 text-center text-[11px] text-zinc-500">Al entrar aceptas trazabilidad y auditoría de accesos.</p></div>
                    </form>
                  )}
                  <div className="mt-6 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /><span className="text-[11px] tracking-wide text-zinc-500">o</span><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a href="/recuperar" className="h-10 rounded-full border border-zinc-200 dark:border-zinc-700 grid place-items-center text-xs font-medium hover:bg-zinc-50">Recuperar acceso</a>
                    <a href="/" className="h-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-medium">Ver demo pública</a>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <button onClick={flipToRegistro} className="w-full h-11 rounded-full border-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 grid place-items-center text-sm font-semibold hover:bg-emerald-600 hover:text-white active:scale-[0.98] transition-all">Registrarme — crear cuenta en 30s</button>
                    <p className="text-center text-[11px] text-zinc-500">¿Sin cuenta? Activa tus radares en <span className="font-medium text-zinc-700">/app</span> tras registrarte.</p>
                  </div>
                </div>
                <div className="border-t border-zinc-200/50 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 px-8 py-3 flex items-center justify-between"><span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Cifrado en tránsito · TLS 1.3</span><span className="text-[11px] text-zinc-500">SOC 2 · 47.2% menos fricción</span></div>
              </div>
              <p className="mt-3 text-center text-[11px] text-zinc-500 px-4">Protegido con rate-limit y JWT rotativo. <a href="/recuperar" className="underline hover:text-zinc-700">¿Problemas?</a></p>
            </div>

            {/* BACK — Registro (volteo) */}
            <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(0)", WebkitTransform: "rotateY(180deg) translateZ(0)" }} aria-hidden={!flipped} className={`absolute inset-0 w-full ${!flipped ? "pointer-events-none" : ""}`}>
              <div className="rounded-[2.5rem] bg-white/85 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/10 dark:border-zinc-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden">
                <div className="p-8 md:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Registrarme</h2><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1">Crea tu cuenta para entrar a <span className="font-medium text-zinc-900 dark:text-white">/app</span>.</p></div>
                    <div className="size-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center shrink-0"><User size={18} weight="fill" className="text-white dark:text-zinc-900" /></div>
                  </div>
                  <form onSubmit={handleRegistro} className="mt-7 space-y-4" noValidate>
                    <UiverseInput id="flip-usuario" label="Nombre de usuario" value={nombreUsuario} onChange={(e) => { setNombreUsuario(e.target.value); if (fieldErrorsReg.nombre_usuario) setFieldErrorsReg(p => ({ ...p, nombre_usuario: undefined })); }} placeholder="ej: andina_sas" required autoComplete="username" delay={0} error={fieldErrorsReg.nombre_usuario} />
                    <UiverseInput id="flip-correo" label="Correo electrónico" type="email" value={correoReg} onChange={(e) => { setCorreoReg(e.target.value); if (fieldErrorsReg.correo) setFieldErrorsReg(p => ({ ...p, correo: undefined })); }} placeholder="tu@empresa.com" required autoComplete="email" delay={80} error={fieldErrorsReg.correo} />
                    <UiverseInput id="flip-contrasena" label="Contraseña nueva" type={showPassReg ? "text" : "password"} value={contrasenaReg} onChange={(e) => { setContrasenaReg(e.target.value); if (fieldErrorsReg.contrasena) setFieldErrorsReg(p => ({ ...p, contrasena: undefined })); }} placeholder="Mín 8, may/min/número" required autoComplete="new-password" icon={showPassReg ? EyeSlash : Eye} onIconClick={() => setShowPassReg(v => !v)} iconLabel={showPassReg ? "Ocultar" : "Mostrar"} delay={160} error={fieldErrorsReg.contrasena} />
                    <UiverseInput id="flip-confirmar" label="Confirmar contraseña" type={showConfirmReg ? "text" : "password"} value={confirmarReg} onChange={(e) => { setConfirmarReg(e.target.value); if (fieldErrorsReg.confirmar) setFieldErrorsReg(p => ({ ...p, confirmar: undefined })); }} placeholder="Repite tu contraseña" required autoComplete="new-password" icon={showConfirmReg ? EyeSlash : Eye} onIconClick={() => setShowConfirmReg(v => !v)} iconLabel={showConfirmReg ? "Ocultar" : "Mostrar"} delay={240} error={fieldErrorsReg.confirmar} />
                    {estadoReg === "error" && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex gap-2.5"><WarningCircle size={18} weight="fill" className="text-red-600" /><p role="alert" className="text-sm text-red-800">{mensajeReg}</p></motion.div>)}
                    {estadoReg === "ok" && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex gap-2.5"><CheckCircle size={18} weight="fill" className="text-emerald-600" /><p role="status" className="text-sm text-emerald-800">{mensajeReg}</p></motion.div>)}
                    <MagneticButton type="submit" disabled={estadoReg === "loading"} className="w-full">{estadoReg === "loading" ? <><span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creando…</> : <>Crear cuenta <ArrowRight size={16} weight="bold" /></>}</MagneticButton>
                  </form>
                  <div className="mt-4 grid gap-2">
                    <button onClick={flipToLogin} className="w-full h-10 rounded-full border border-zinc-200 dark:border-zinc-700 grid place-items-center text-xs font-medium hover:bg-zinc-50">Ya tengo cuenta — Iniciar sesión</button>
                    <p className="text-center text-[11px] text-zinc-500">Al registrarte aceptas auditoría y rate-limit.</p>
                  </div>
                </div>
                <div className="border-t border-zinc-200/50 bg-zinc-50/60 px-8 py-3 flex items-center justify-between"><span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Registro abierto</span><button onClick={flipToLogin} className="text-[11px] font-medium text-emerald-700 hover:underline">Volver a login →</button></div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <footer className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800 mt-auto">
        <span>© 2026 SECOP Insight · Datos abiertos SECOP II · <a href="https://www.datos.gov.co" target="_blank" rel="noreferrer" className="underline hover:text-zinc-700">datos.gov.co</a></span>
        <span className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" /> API 127.0.0.1:8000</span><span>·</span><span>Hecho para veeduría ciudadana</span></span>
      </footer>
    </div>
  );
}
