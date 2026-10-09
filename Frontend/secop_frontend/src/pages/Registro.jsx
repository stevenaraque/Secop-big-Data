import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../components/glass-card.css";
import { motion } from "motion/react";
import {
  ShieldCheck,
  User,
  EnvelopeSimple,
  CheckCircle,
  ArrowRight,
  Buildings,
  Lightning,
  Sparkle,
} from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle.jsx";
import RegistroForm from "../components/RegistroForm.jsx";
import Enlace from "../components/Enlace.jsx";
import { API_URL as API } from "../lib/api.js";

function LivePulse() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-800 dark:text-emerald-300">
      <span className="relative flex size-2">
        <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-ping" />
        <span className="relative rounded-full bg-emerald-500 size-2" />
      </span>
      Registro abierto
      <span className="size-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      JWT + PBKDF2
    </span>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function Registro() {
  // Lectura inicial perezosa: evita setState en effect solo para leer localStorage al montar
  const [sesionGuardada] = useState(() => !!localStorage.getItem("access"));
  // P1-2: router SPA en vez de window.location.href (conserva Query cache, sin reload full)
  const nav = useNavigate();

  if (sesionGuardada) {
    return (
      <div className="min-h-[100dvh] relative overflow-hidden">
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
              <Enlace to="/app" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-11 px-6 text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all">Ir a mis radares <ArrowRight size={16} weight="bold" /></Enlace>
              <Enlace to="/login" className="h-11 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 grid place-items-center text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Ir a login</Enlace>
            </motion.div>
          </motion.div>
          <div className="glass-card rounded-[2.5rem] max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end w-full p-8">
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
    <div className="min-h-[100dvh] relative overflow-hidden flex flex-col">
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
          <span className="hidden md:inline-flex ml-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 backdrop-blur">v3.3 · Registro abierto</span>
        </div>
        <div className="flex items-center gap-2">
          <Enlace to="/login" className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline-offset-4 hover:underline">¿Ya tienes cuenta? Entrar</Enlace>
          <ThemeToggle />
        </div>
      </header>

      <main id="contenido" className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-10 lg:pb-12 grid grid-cols-1 lg:grid-cols-[1.18fr_0.92fr] gap-8 lg:gap-10 items-start lg:items-center">
        {/* LEFT editorial */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="pt-2 lg:pt-0 lg:pl-[1.5vw] order-2 lg:order-1">
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
            <LivePulse />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1 text-[11px] font-medium"><Sparkle size={12} weight="fill" /> Alta inmediata · sin papeleo</span>
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
              <div key={c.label} className="glass-card group relative rounded-[2rem] p-5">
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

          <motion.div variants={fadeUp} className="glass-card mt-8 rounded-2xl px-4 py-3 flex gap-3 max-w-[560px]">
            <div className="size-8 rounded-full bg-zinc-900 dark:bg-white grid place-items-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-white dark:text-zinc-900">“</span></div>
            <div>
              <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">Me registré, creé un radar por "pavimento Boyacá" y al día siguiente ya tenía 4 oportunidades filtradas. Cero fricción.</div>
              <div className="text-xs text-zinc-500 mt-1.5">Carlos Rivera — Contratista vial, 12 licitaciones / mes</div>
            </div>
          </motion.div>
        </motion.div>

        {/* RIGHT glass registro */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.18 }} className="order-1 lg:order-2 w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end lg:sticky lg:top-6">
          <div className="glass-card rounded-[2.5rem] overflow-hidden">
            <div className="p-8 md:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "Geist, Satoshi, ui-sans-serif" }}>Registrarme</h2>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1 max-w-[30ch]">Crea tu cuenta para entrar a <span className="font-medium text-zinc-900 dark:text-white">/app</span> y activar notificaciones.</p>
                </div>
                <div className="size-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center shrink-0"><User size={18} weight="fill" className="text-white dark:text-zinc-900" /></div>
              </div>

              <RegistroForm onExito={() => setTimeout(() => nav("/login"), 1400)} />

              <div className="mt-6 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /><span className="text-[11px] tracking-wide text-zinc-500">o</span><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Enlace to="/login" className="h-10 rounded-full border border-zinc-200 dark:border-zinc-700 grid place-items-center text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all">Ya tengo cuenta</Enlace>
                <Enlace to="/" className="h-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.98] transition-all">Ver demo</Enlace>
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
        <span>© 2026 SECOP Insight · Registro abierto · <Enlace to="/login" className="underline hover:text-zinc-700">¿Ya tienes cuenta? Entra</Enlace></span>
        <span className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" /> API {API.replace("/api","")}</span><span>·</span><span>Radares → notificaciones</span></span>
      </footer>
    </div>
  );
}
