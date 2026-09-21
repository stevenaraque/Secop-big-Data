import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import {
  ShieldCheck,
  User,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  Buildings,
  Lightning,
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
    <motion.button
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white text-[14px] font-medium tracking-[-0.01em] h-11 px-6 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.5)] hover:bg-emerald-700 active:scale-[0.98] active:-translate-y-[1px] transition-[background,transform] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${className}`}
      whileTap={disabled ? undefined : { scale: 0.98, y: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

function LivePulse() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-800 dark:text-emerald-300">
      <span className="relative flex size-2">
        <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-ping" />
        <span className="relative rounded-full bg-emerald-500 size-2" />
      </span>
      Registro abierto · 1.2s
      <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      JWT + PBKDF2
    </span>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function Registro() {
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [estado, setEstado] = useState("idle"); // idle | loading | error | ok
  const [mensaje, setMensaje] = useState("");
  const [fieldErrors, setFieldErrors] = useState({}); // {nombre_usuario, correo, contrasena, confirmar, _global}
  const [sesionGuardada, setSesionGuardada] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSesionGuardada(!!localStorage.getItem("access"));
    setChecked(true);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");
    setFieldErrors({});
    // validación cliente unificada con backend (8+ may/min/número) — mensajes idénticos a _validar_politica_contrasena
    if (contrasena !== confirmar) {
      setFieldErrors({ confirmar: "Las contraseñas no coinciden." });
      setEstado("error");
      setMensaje("Las contraseñas no coinciden.");
      return;
    }
    if (contrasena.length < 8) {
      setFieldErrors({ contrasena: "La contraseña debe tener al menos 8 caracteres." });
      setEstado("error");
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(contrasena)) {
      setFieldErrors({ contrasena: "La contraseña debe tener al menos una mayúscula." });
      setEstado("error");
      setMensaje("La contraseña debe tener al menos una mayúscula.");
      return;
    }
    if (!/[a-z]/.test(contrasena)) {
      setFieldErrors({ contrasena: "La contraseña debe tener al menos una minúscula." });
      setEstado("error");
      setMensaje("La contraseña debe tener al menos una minúscula.");
      return;
    }
    if (!/[0-9]/.test(contrasena)) {
      setFieldErrors({ contrasena: "La contraseña debe tener al menos un número." });
      setEstado("error");
      setMensaje("La contraseña debe tener al menos un número.");
      return;
    }
    setEstado("loading");
    try {
      const r = await fetch(`${API}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_usuario: nombreUsuario.trim(), correo: correo.trim(), contrasena }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // unifica errores por campo: backend devuelve {correo: [...], nombre_usuario: [...], contrasena: [...], non_field_errors: [...] } o {detalle}
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
        // si backend devuelve string plano (validate_correo)
        if (typeof data === "string") fe._global = data;
        const detalle = fe._global || fe.correo || fe.nombre_usuario || fe.contrasena || data.detalle || data.detail || JSON.stringify(data).slice(0, 220);
        if (Object.keys(fe).length) setFieldErrors(fe);
        throw new Error(detalle || "No se pudo crear la cuenta.");
      }
      setFieldErrors({});
      setEstado("ok");
      setMensaje("Cuenta creada. Ya puedes entrar al dashboard y crear tus radares de notificaciones.");
      setTimeout(() => { window.location.href = "/login"; }, 1400);
    } catch (err) {
      setEstado("error");
      setMensaje(err.message);
    }
  }

  if (!checked) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#fcfcfc] dark:bg-zinc-950">
        <span className="size-6 rounded-full border-2 border-zinc-200 border-t-emerald-600 animate-spin" aria-label="Cargando" />
      </div>
    );
  }

  if (sesionGuardada) {
    return (
      <div className="min-h-[100dvh] bg-[#fcfcfc] dark:bg-zinc-950 relative overflow-hidden">
        <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 size-[520px] rounded-full bg-emerald-200/30 dark:bg-emerald-900/20 blur-[80px]" />
          <div className="absolute top-40 -left-40 size-[640px] rounded-full bg-zinc-200/60 dark:bg-zinc-800/40 blur-[90px]" />
        </div>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center"><span className="text-white dark:text-zinc-900 font-mono text-[11px] font-bold tracking-tighter">SI</span></div>
            <span className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <motion.div variants={stagger} initial="hidden" animate="show" className="pl-0 lg:pl-[2vw]">
            <motion.div variants={fadeUp}><LivePulse /></motion.div>
            <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-6xl font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>
              Ya tienes<br /><span className="text-zinc-500 dark:text-zinc-400">sesión activa.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[65ch]">Ve directo a <span className="font-medium text-zinc-900 dark:text-white">/app</span> y crea tus radares para notificaciones. O registra otra cuenta.</motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <a href="/app" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-11 px-6 text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all">Ir a mis radares <ArrowRight size={16} weight="bold" /></a>
              <a href="/login" className="h-11 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 grid place-items-center text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Ir a login</a>
            </motion.div>
          </motion.div>
          <div className="rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end w-full">
            <div className="size-10 rounded-2xl bg-emerald-600 grid place-items-center text-white"><CheckCircle size={20} weight="fill" /></div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Sesión guardada</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Borra el token si quieres registrar una empresa distinta.</p>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-6 w-full h-11 rounded-full border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Borrar sesión</button>
          </div>
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
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tighter text-zinc-900 dark:text-white">SECOP Insight</div>
            <div className="text-[11px] tracking-wide text-zinc-500 hidden sm:block">Observatorio · Contratación pública</div>
          </div>
          <span className="hidden md:inline-flex ml-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 backdrop-blur">v3.1 · Registro abierto</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/login" className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline-offset-4 hover:underline">¿Ya tienes cuenta? Entrar</a>
          <ThemeToggle />
        </div>
      </header>

      <main id="contenido" className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-10 lg:pb-12 grid grid-cols-1 lg:grid-cols-[1.18fr_0.92fr] gap-8 lg:gap-10 items-start lg:items-center">
        {/* LEFT editorial */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="pt-2 lg:pt-0 lg:pl-[1.5vw] order-2 lg:order-1">
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
            <LivePulse />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1 text-[11px] font-medium"><Sparkle size={12} weight="fill" /> Alta en 1.2s · sin papeleo</span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="mt-6 text-4xl md:text-[52px] lg:text-[56px] font-semibold tracking-tighter leading-none text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif, system-ui" }}>
            Crea tu cuenta
            <br /><span className="text-zinc-500 dark:text-zinc-400">y activa tus radares.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-[58ch]">
            Regístrate en 30 segundos, entra a <span className="font-medium text-zinc-900 dark:text-white">/app</span> y configura notificaciones por palabra clave, ciudad o NIT. Sin validación manual — <span className="font-medium text-zinc-900 dark:text-white">acceso inmediato</span>.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-4 max-w-[560px]">
            {[
              { icon: Buildings, k: "5", label: "radares por usuario", sub: "palabra + filtros_extras" },
              { icon: EnvelopeSimple, k: "4", label: "oportunidades/día", sub: "tope anti-spam" },
              { icon: Lightning, k: "23ms", label: "latencia API", sub: "JWT HS256 1h/1d" },
              { icon: ShieldCheck, k: "PBKDF2", label: "hash seguro", sub: "8+ may/min/número" },
            ].map((c) => (
              <div key={c.label} className="group relative rounded-[2rem] border border-slate-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.07)] transition-shadow">
                <div className="flex items-center justify-between"><c.icon size={18} weight="regular" className="text-zinc-900 dark:text-white" /><span className="size-1.5 rounded-full bg-emerald-500/70 group-hover:bg-emerald-500 transition-colors" /></div>
                <div className="mt-3 font-mono text-[20px] font-semibold tracking-tighter text-zinc-900 dark:text-white leading-none">{c.k}</div>
                <div className="text-[12px] font-medium tracking-tight text-zinc-900 dark:text-white mt-1">{c.label}</div>
                <div className="text-[11px] text-zinc-500">{c.sub}</div>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-emerald-600" /> Correo único</span>
            <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>Token inmediato tras login</span>
            <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>Radares → notificaciones</span>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur px-4 py-3 flex gap-3 max-w-[560px]">
            <div className="size-8 rounded-full bg-zinc-900 dark:bg-white grid place-items-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-white dark:text-zinc-900">“</span></div>
            <div>
              <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">Me registré, creé un radar por "pavimento Boyacá" y al día siguiente ya tenía 4 oportunidades filtradas. Cero fricción.</div>
              <div className="text-xs text-zinc-500 mt-1.5">Carlos Rivera — Contratista vial, 12 licitaciones / mes</div>
            </div>
          </motion.div>
        </motion.div>

        {/* RIGHT glass registro */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.18 }} className="order-1 lg:order-2 w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end lg:sticky lg:top-6">
          <div className="rounded-[2.5rem] bg-white/85 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/10 dark:border-zinc-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden">
            <div className="p-8 md:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Registrarme</h2>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1 max-w-[30ch]">Crea tu cuenta para entrar a <span className="font-medium text-zinc-900 dark:text-white">/app</span> y activar notificaciones.</p>
                </div>
                <div className="size-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center shrink-0"><User size={18} weight="fill" className="text-white dark:text-zinc-900" /></div>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
                {/* Uiverse + animejs — 4 inputs stagger 0/80/160/240 + fieldErrors unificados cliente/servidor */}
                <UiverseInput id="registro-usuario" label="Nombre de usuario" value={nombreUsuario} onChange={(e) => { setNombreUsuario(e.target.value); if (fieldErrors.nombre_usuario) setFieldErrors((p) => ({ ...p, nombre_usuario: undefined })); }} placeholder="ej: andina_sas" required autoComplete="username" delay={0} error={fieldErrors.nombre_usuario} />
                <p className="text-[11px] text-zinc-500 -mt-2 px-1">Visible en auditoría, no en contratos públicos.</p>

                <UiverseInput id="registro-correo" label="Correo" type="email" value={correo} onChange={(e) => { setCorreo(e.target.value); if (fieldErrors.correo) setFieldErrors((p) => ({ ...p, correo: undefined })); }} placeholder="tu@empresa.com" required autoComplete="email" delay={80} error={fieldErrors.correo} />
                <p className="text-[11px] text-zinc-500 -mt-2 px-1">Debe ser único. Usaremos este correo para notificaciones de radar.</p>

                <UiverseInput id="registro-contrasena" label="Contraseña" type={showPass ? "text" : "password"} value={contrasena} onChange={(e) => { setContrasena(e.target.value); if (fieldErrors.contrasena) setFieldErrors((p) => ({ ...p, contrasena: undefined })); }} placeholder="Mín 8, may/min/número" required autoComplete="new-password" icon={showPass ? EyeSlash : Eye} onIconClick={() => setShowPass((v) => !v)} iconLabel={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} delay={160} error={fieldErrors.contrasena} />
                <p className="text-[11px] text-zinc-500 -mt-2 px-1">PBKDF2 · 8+ con mayúscula, minúscula y número.</p>

                <UiverseInput id="registro-confirmar" label="Confirmar contraseña" type={showConfirm ? "text" : "password"} value={confirmar} onChange={(e) => { setConfirmar(e.target.value); if (fieldErrors.confirmar) setFieldErrors((p) => ({ ...p, confirmar: undefined })); }} placeholder="Repite tu contraseña" required autoComplete="new-password" icon={showConfirm ? EyeSlash : Eye} onIconClick={() => setShowConfirm((v) => !v)} iconLabel={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"} delay={240} error={fieldErrors.confirmar} />

                {estado === "error" && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex gap-2.5">
                    <WarningCircle size={18} weight="fill" className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <p role="alert" className="text-sm leading-relaxed text-red-800 dark:text-red-300">{mensaje}</p>
                  </motion.div>
                )}
                {estado === "ok" && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 flex gap-2.5">
                    <CheckCircle size={18} weight="fill" className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p role="status" className="text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">{mensaje}</p>
                  </motion.div>
                )}

                <div className="pt-1">
                  <MagneticButton type="submit" disabled={estado === "loading"} className="w-full">
                    {estado === "loading" ? <><span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creando cuenta…</> : <>Crear cuenta <ArrowRight size={16} weight="bold" /></>}
                  </MagneticButton>
                  <p className="mt-2 text-center text-[11px] text-zinc-500">Al registrarte aceptas trazabilidad de auditoría y rate-limit 100/min.</p>
                </div>
              </form>

              <div className="mt-6 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /><span className="text-[11px] tracking-wide text-zinc-500">o</span><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href="/login" className="h-10 rounded-full border border-zinc-200 dark:border-zinc-700 grid place-items-center text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all">Ya tengo cuenta</a>
                <a href="/" className="h-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.98] transition-all">Ver demo</a>
              </div>
            </div>
            <div className="border-t border-zinc-200/50 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 px-8 py-3 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Registro abierto</span>
              <span className="text-[11px] text-zinc-500">→ /login → /app</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-500 px-4">Tras registrarte, haz login y ve a <span className="font-medium text-zinc-700 dark:text-zinc-300">/app</span> para crear tu primer radar y recibir notificaciones.</p>
        </motion.div>
      </main>

      <footer className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800 mt-auto">
        <span>© 2026 SECOP Insight · Registro abierto · <a href="/login" className="underline hover:text-zinc-700">¿Ya tienes cuenta? Entra</a></span>
        <span className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" /> API {API.replace("/api","")}</span><span>·</span><span>Radares → notificaciones</span></span>
      </footer>
    </div>
  );
}
