import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
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
} from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle.jsx";
import SpecularButton from "../components/SpecularButton.jsx";
import "../components/glass-card.css";
import UiverseInput from "../components/UiverseInput.jsx";
import Enlace from "../components/Enlace.jsx";
import { API_URL as API } from "../lib/api.js";

function LivePulse({ text = "SECOP II · Datos abiertos" }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-800 dark:text-emerald-300">
      <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-ping" /><span className="relative rounded-full bg-emerald-500 size-2" /></span>
      {text}
      <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />datos.gov.co
    </span>
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
  // Lectura inicial perezosa: evita setState en effect solo para leer localStorage al montar
  const [sesionGuardada, setSesionGuardada] = useState(() => !!localStorage.getItem("access"));
  const nav = useNavigate();
  // Volteo de carta: gira 90° y navega (la otra página entra desde -90°).
  const [saliendo, setSaliendo] = useState(null);
  function irConVolteo(e, to) {
    e?.preventDefault?.();
    if (saliendo) return;
    setSaliendo(to);
    setTimeout(() => nav(to), 430);
  }

  async function handleLogin(e) {
    e.preventDefault();
    const correoLimpio = correo.trim().toLowerCase();
    if (!correoLimpio || !contrasena) { setEstado("error"); setMensaje("Escribe tu correo y contraseña."); return; }
    setEstado("loading"); setMensaje("");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(`${API}/auth/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: correoLimpio, contrasena }), signal: ctrl.signal });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) throw new Error("Demasiados intentos. Espera un minuto e intenta de nuevo.");
      if (!r.ok) throw new Error(data.non_field_errors?.[0] || data.detalle || data.detail || data.error || "No se pudo iniciar sesión.");
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      nav("/app");
    } catch (err) { setEstado("error"); setMensaje(err?.name === "AbortError" ? "Tiempo de espera agotado (15s). Revisa tu conexión o el backend." : err.message); }
    finally { clearTimeout(t); }
  }
  function usarOtraCuenta() { localStorage.removeItem("access"); localStorage.removeItem("refresh"); setSesionGuardada(false); }

  if (sesionGuardada) {
    return (
      <div className="min-h-[100dvh] relative isolate overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="size-8 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center"><span className="text-white dark:text-zinc-900 font-mono text-[11px] font-bold tracking-tighter">SI</span></div><span className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</span><span className="hidden sm:inline text-[11px] tracking-wide text-zinc-500">· Observatorio SECOP II</span></div>
          <div className="flex items-center gap-2"><Enlace to="/registro" className="hidden sm:inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700">Registrarme</Enlace><ThemeToggle /></div>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 lg:py-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <motion.div variants={stagger} initial="hidden" animate="show" className="pl-0 lg:pl-[2vw]">
            <motion.div variants={fadeUp}><LivePulse /></motion.div>
            <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-6xl font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Ya tienes<br /><span className="text-zinc-500 dark:text-zinc-400">sesión guardada.</span></motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[65ch]">Evita pedir la clave otra vez. Entra directo al dashboard o cambia de cuenta.</motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <Enlace to="/app" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-11 px-6 hover:bg-emerald-700">Entrar al dashboard <ArrowRight size={16} weight="bold" /></Enlace>
              <button type="button" onClick={usarOtraCuenta} className="h-11 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6">Usar otra cuenta</button>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.22 }} className="w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end">
            <div className="glass-card rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3"><div className="size-9 rounded-full bg-emerald-600 grid place-items-center text-white"><ShieldCheck size={18} weight="fill" /></div><div><div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">Sesión activa</div><div className="text-xs text-zinc-500">Token guardado</div></div><span className="ml-auto size-2 rounded-full bg-emerald-500 animate-pulse" /></div>
              <Enlace to="/app" className="mt-6 flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">Entrar al dashboard <ArrowRight size={16} /></Enlace>
              <button type="button" onClick={usarOtraCuenta} className="mt-3 w-full h-11 rounded-full border border-zinc-200 dark:border-zinc-700">Borrar sesión</button>
              <Enlace to="/registro" className="mt-2 w-full h-10 rounded-full border-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 grid place-items-center text-xs font-semibold hover:bg-emerald-600 hover:text-white">Registrar nueva empresa</Enlace>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] relative isolate overflow-hidden flex flex-col">
      <header className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center shadow-sm"><span className="font-mono text-[11px] font-bold tracking-tighter text-white dark:text-zinc-900">SI</span></div>
          <div className="leading-none"><div className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</div><div className="text-[11px] tracking-wide text-zinc-500 hidden sm:block">Observatorio · Contratación pública SECOP II</div></div>
          <span className="hidden md:inline-flex ml-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 backdrop-blur">v3.3 · Render + Vercel</span>
        </div>
        <div className="flex items-center gap-2">
          <Enlace to="/registro" className="hidden sm:inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700 active:scale-[0.98] transition-all">
            Registrarme
          </Enlace>
          <Enlace to="/" className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 underline-offset-4 hover:underline">Ver observatorio</Enlace>
          <ThemeToggle />
        </div>
      </header>

      <main id="contenido" className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-10 lg:pb-12 grid grid-cols-1 lg:grid-cols-[1.18fr_0.92fr] gap-8 lg:gap-10 items-start lg:items-center">
        {/* LEFT editorial con crossfade suave */}
        <div className="pt-2 lg:pt-0 lg:pl-[1.5vw] order-2 lg:order-1 min-h-[520px] flex flex-col justify-center">
          <motion.div key="login-left" variants={stagger} initial="hidden" animate="show">
                <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2"><LivePulse /><span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1 text-[11px] font-medium"><Lightning size={12} weight="fill" /> Datos abiertos · Datos.gov.co</span></motion.div>
                <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-[52px] lg:text-[56px] font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Contratación<br /><span className="text-zinc-500 dark:text-zinc-400">por fin legible.</span></motion.h1>
                <motion.p variants={fadeUp} className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-[58ch]">Cruza SECOP II con trazabilidad real: entidades, contratistas y modalidad en un solo lugar. Sin jerga, sin humo — <span className="font-medium text-zinc-900 dark:text-white">solo evidencia</span> para veeduría, periodismo y control interno.</motion.p>
                <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-4 max-w-[560px]">
                  {[{ icon: ChartBar, k: "<50KB", label: "agregados por filtro", sub: "SUM/COUNT en BD", accent: "text-emerald-600" },{ icon: Buildings, k: "95", label: "columnas elegibles", sub: "filtros_extras JSON", accent: "text-zinc-900 dark:text-white" },{ icon: MagnifyingGlass, k: "29×", label: "optimizado vs naive", sub: "280ms vs 8s profiler", accent: "text-amber-600" },{ icon: ClockClockwise, k: "60 FPS", label: "tabla virtualizada", sub: "solo 50 nodos en DOM", accent: "text-zinc-600" }].map((c) => (
                    <div key={c.label} className="glass-card group relative rounded-[2rem] p-5">
                      <div className="flex items-center justify-between"><c.icon size={18} weight="regular" className={c.accent} /><span className="size-1.5 rounded-full bg-emerald-500/70" /></div>
                      <div className="mt-3 font-mono text-[22px] font-semibold tracking-tighter text-zinc-900 dark:text-white leading-none">{c.k}</div>
                      <div className="text-[12px] font-medium tracking-tight text-zinc-900 dark:text-white mt-1">{c.label}</div>
                      <div className="text-[11px] text-zinc-500">{c.sub}</div>
                    </div>
                  ))}
                </motion.div>
                <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500"><span className="inline-flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-emerald-600" /> TLS 1.3 · HSTS</span><span className="size-1 rounded-full bg-zinc-300" /><span>Rate-limit 100/min</span><span className="size-1 rounded-full bg-zinc-300" /><span>JWT + blacklist</span></motion.div>
                <motion.div variants={fadeUp} className="glass-card mt-8 rounded-2xl px-4 py-3 flex gap-3 max-w-[560px]">
                  <div className="size-8 rounded-full bg-zinc-900 dark:bg-white grid place-items-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-white dark:text-zinc-900">“</span></div>
                  <div><div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">Pasamos de Excel disperso a una sola vista. Las banderas por contratación directa nos ahorraron dos semanas de revisión.</div><div className="text-xs text-zinc-500 mt-1.5">Laura Méndez — Oficina Jurídica, Alcaldía intermedia <span className="ml-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium">Testimonio ejemplo</span></div></div>
                </motion.div>
              </motion.div>
        </div>

        {/* RIGHT — tarjeta login con volteo 3D al ir a registro */}
        <div className="order-1 lg:order-2 w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end lg:sticky lg:top-6 [perspective:1400px]">
          <motion.div
            initial={{ opacity: 0, y: 18, rotateY: 0 }}
            animate={saliendo ? { opacity: 0, rotateY: 90 } : { opacity: 1, y: 0, rotateY: 0 }}
            transition={saliendo ? { duration: 0.4, ease: [0.16, 1, 0.3, 1] } : { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
            className="relative w-full"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Login */}
            <div className="w-full">
              <div className="glass-card rounded-[2.5rem] overflow-hidden">
                <div className="p-8 md:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Iniciar sesión</h2><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1 max-w-[28ch]">Entra con tu correo institucional para ver el dashboard privado.</p></div>
                    <div className="size-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center shrink-0"><ShieldCheck size={18} weight="fill" className="text-white dark:text-zinc-900" /></div>
                  </div>
                    <form onSubmit={handleLogin} className="mt-7 space-y-4" noValidate>
                      <UiverseInput id="login-correo" label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" delay={0} />
                      <p className="text-[11px] text-zinc-500 -mt-2">Usa el correo con el que te registraste. No compartas tu clave.</p>
                      <UiverseInput id="login-contrasena" label="Contraseña" type={showPass ? "text" : "password"} value={contrasena} onChange={(e) => setContrasena(e.target.value)} placeholder="Tu contraseña" required autoComplete="current-password" icon={showPass ? EyeSlash : Eye} onIconClick={() => setShowPass((v) => !v)} iconLabel={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} delay={80} />
                      <div className="flex justify-end -mt-3"><Enlace to="/recuperar" className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 underline-offset-4 hover:underline">Olvidé mi clave</Enlace></div>
                      {estado === "error" && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex gap-2.5"><WarningCircle size={18} weight="fill" className="text-red-600 shrink-0 mt-0.5" /><p role="alert" className="text-sm leading-relaxed text-red-800 dark:text-red-300">{mensaje}</p></motion.div>)}
                      <div className="pt-1"><SpecularButton type="submit" disabled={estado === "loading"} className="w-full" style={{ height: 44 }}>{estado === "loading" ? (<><span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Verificando…</>) : (<>Entrar <ArrowRight size={16} weight="bold" /></>)}</SpecularButton><p className="mt-2 text-center text-[11px] text-zinc-500">Al entrar aceptas trazabilidad y auditoría de accesos.</p></div>
                    </form>
                  <div className="mt-6 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /><span className="text-[11px] tracking-wide text-zinc-500">o</span><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Enlace to="/recuperar" className="h-10 rounded-full border border-zinc-200 dark:border-zinc-700 grid place-items-center text-xs font-medium hover:bg-zinc-50">Recuperar acceso</Enlace>
                    <Enlace to="/" className="h-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-medium">Ver demo pública</Enlace>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <SpecularButton onClick={(e) => irConVolteo(e, "/registro")} tint="#ffffff" tintOpacity={0} textColor="#059669" lineColor="#6ee7b7" baseColor="#a7f3d0" className="w-full" style={{ height: 44, border: "2px solid #059669" }}>Registrarme — crear cuenta en 30s</SpecularButton>
                    <p className="text-center text-[11px] text-zinc-500">¿Sin cuenta? Activa tus radares en <span className="font-medium text-zinc-700">/app</span> tras registrarte.</p>
                  </div>
                </div>
                <div className="glass-card px-8 py-3 flex items-center justify-between"><span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Cifrado en tránsito · TLS 1.3</span><span className="text-[11px] text-zinc-500">JWT + blacklist</span></div>
              </div>
              <p className="mt-3 text-center text-[11px] text-zinc-500 px-4">Protegido con rate-limit y JWT rotativo. <Enlace to="/recuperar" className="underline hover:text-zinc-700">¿Problemas?</Enlace></p>
            </div>

          </motion.div>
        </div>
      </main>
      <footer className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800 mt-auto">
        <span>© 2026 SECOP Insight · Datos abiertos SECOP II · <a href="https://www.datos.gov.co" target="_blank" rel="noreferrer" className="underline hover:text-zinc-700">datos.gov.co</a></span>
        <span className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" /> API {API.replace("/api", "")}</span><span>·</span><span>Hecho para veeduría ciudadana</span></span>
      </footer>
    </div>
  );
}
