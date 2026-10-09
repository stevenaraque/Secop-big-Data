import { useState, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import {
  Eye,
  EyeSlash,
  WarningCircle,
  CheckCircle,
  ArrowRight,
} from "@phosphor-icons/react";
import UiverseInput from "./UiverseInput.jsx";
import { API_URL as API } from "../lib/api.js";

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

// RegistroForm — formulario de registro reutilizable (página /registro y dorso de la carta /login).
// Qué: 4 campos + validación cliente espejo del backend + POST + mensajes. Por qué: un solo form, dos caras.
export default function RegistroForm({ onExito }) {
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [estado, setEstado] = useState("idle"); // idle | loading | error | ok
  const [mensaje, setMensaje] = useState("");
  const [fieldErrors, setFieldErrors] = useState({}); // {nombre_usuario, correo, contrasena, confirmar, _global}

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");
    setFieldErrors({});
    // P2: vacíos tras trim se rechazan en cliente (antes viajaban como "" → 400 evitable)
    if (!nombreUsuario.trim() || !correo.trim()) {
      setFieldErrors({
        ...(!nombreUsuario.trim() ? { nombre_usuario: "Escribe tu nombre de usuario." } : {}),
        ...(!correo.trim() ? { correo: "Escribe tu correo." } : {}),
      });
      setEstado("error");
      setMensaje("Escribe tu nombre de usuario y correo.");
      return;
    }
    // validación cliente unificada con backend (8-128, may/min/número, común, similitud) — mensajes idénticos a _validar_politica_contrasena
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
    if (contrasena.length > 128) {
      setFieldErrors({ contrasena: "La contraseña debe tener máximo 128 caracteres." });
      setEstado("error");
      setMensaje("La contraseña debe tener máximo 128 caracteres.");
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
    // P1-3: comunes (subconjunto top — backend valida lista Django 20k completa, incluye Password1)
    const COMUNES = new Set(["password", "password1", "12345678", "123456789", "qwerty", "abc123", "1234567", "letmein", "welcome", "admin123", "contrasena1"]);
    if (COMUNES.has(contrasena.toLowerCase())) {
      setFieldErrors({ contrasena: "La contraseña es demasiado común. Elige otra menos predecible." });
      setEstado("error");
      setMensaje("La contraseña es demasiado común. Elige otra menos predecible.");
      return;
    }
    // P1-3: similitud con usuario/correo (pre-chequeo substring min 5 — backend aplica SimilarityValidator 0.7 autoritativo).
    // Min 5 evita falsos positivos con locales cortos (ej: "test" no bloquea Test1234A, el backend tampoco).
    {
      const clave = contrasena.toLowerCase();
      const attrs = [nombreUsuario, correo.split("@")[0], correo];
      const similar = attrs.some((a) => {
        const n = (a || "").trim().toLowerCase();
        return n.length >= 5 && (n.includes(clave) || clave.includes(n));
      });
      if (similar) {
        setFieldErrors({ contrasena: "La contraseña es demasiado similar al usuario o correo. Elige otra." });
        setEstado("error");
        setMensaje("La contraseña es demasiado similar al usuario o correo. Elige otra.");
        return;
      }
    }
    setEstado("loading");
    // P1-1: mismo timeout 15s + 429 que Login (antes fetch pelado = cuelgue en red lenta)
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(`${API}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_usuario: nombreUsuario.trim(), correo: correo.trim().toLowerCase(), contrasena }),
        signal: ctrl.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) throw new Error("Demasiados intentos. Espera un minuto e intenta de nuevo.");
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
      // P0-1: backend siempre retorna 200 genérico anti-enumeración (existe vs nuevo idéntico).
      // Mostrar data.detalle evita mentir "Cuenta creada" cuando el correo ya existía.
      setMensaje(data.detalle || "Si el correo no existía, cuenta creada; si ya existía, se envió notificación a tu email.");
      if (onExito) onExito();
    } catch (err) {
      setEstado("error");
      setMensaje(err?.name === "AbortError" ? "Tiempo de espera agotado (15s). Revisa tu conexión o el backend." : err.message);
    } finally {
      clearTimeout(t);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
      {/* Uiverse + animejs — 4 inputs stagger 0/80/160/240 + fieldErrors unificados cliente/servidor */}
      <UiverseInput id="registro-usuario" label="Nombre de usuario" value={nombreUsuario} onChange={(e) => { setNombreUsuario(e.target.value); if (fieldErrors.nombre_usuario) setFieldErrors((p) => ({ ...p, nombre_usuario: undefined })); }} placeholder="ej: andina_sas" required autoComplete="username" delay={0} error={fieldErrors.nombre_usuario} />
      <p className="text-[11px] text-zinc-500 -mt-2 px-1">Visible en auditoría, no en contratos públicos.</p>

      <UiverseInput id="registro-correo" label="Correo" type="email" value={correo} onChange={(e) => { setCorreo(e.target.value); if (fieldErrors.correo) setFieldErrors((p) => ({ ...p, correo: undefined })); }} placeholder="tu@empresa.com" required autoComplete="email" delay={80} error={fieldErrors.correo} />
      <p className="text-[11px] text-zinc-500 -mt-2 px-1">Debe ser único. Usaremos este correo para notificaciones de radar.</p>

      <UiverseInput id="registro-contrasena" label="Contraseña" type={showPass ? "text" : "password"} value={contrasena} onChange={(e) => { setContrasena(e.target.value); if (fieldErrors.contrasena) setFieldErrors((p) => ({ ...p, contrasena: undefined })); }} placeholder="Mín 8, may/min/número" required autoComplete="new-password" icon={showPass ? EyeSlash : Eye} onIconClick={() => setShowPass((v) => !v)} iconLabel={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} delay={160} error={fieldErrors.contrasena} />
      <p className="text-[11px] text-zinc-500 -mt-2 px-1">PBKDF2 · 8-128, mayúscula, minúscula, número, no común ni similar a tu usuario.</p>

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
  );
}
