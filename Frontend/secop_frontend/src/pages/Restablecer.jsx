import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle.jsx";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

function leerTokenInicial() {
  try {
    const params = new URLSearchParams(window.location.search);
    const porQuery = params.get("token");
    if (porQuery) return porQuery;
    // Soporta /restablecer/:token (App.jsx declara la ruta con :token)
    const m = window.location.pathname.match(/\/restablecer\/([^/?#]+)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {
    /* SSR/tests sin window: token vacío */
  }
  return "";
}

export default function Restablecer() {
  const [token, setToken] = useState(leerTokenInicial);
  const [nueva, setNueva] = useState("");
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado("loading");
    setMensaje("");
    try {
      const r = await fetch(`${API}/auth/restablecer/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nueva_contrasena: nueva }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detalle || data.nueva_contrasena?.[0] || JSON.stringify(data));
      setEstado("ok");
      setMensaje(data.detalle);
    } catch (err) {
      setEstado("error");
      setMensaje(err.message);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] dark:bg-zinc-950 grid place-items-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Restablecer contraseña</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Enlace válido 30 min y un solo uso. La nueva clave debe tener 8+ con mayúscula, minúscula y número.
            </p>
          </div>
          <ThemeToggle />
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Token
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="token del enlace"
              className="mt-1 w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Nueva contraseña
            <input
              type="password"
              required
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Ej: NuevaClave123"
              className="mt-1 w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            />
          </label>
          <button
            type="submit"
            disabled={estado === "loading"}
            className="w-full h-10 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
          >
            {estado === "loading" ? "Guardando..." : "Restablecer"}
          </button>
        </form>
        {estado === "ok" && (
          <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl px-3 py-2">
            {mensaje} — <a href="/" className="underline">ir a iniciar sesión</a>
          </p>
        )}
        {estado === "error" && (
          <p className="mt-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
            {mensaje}
          </p>
        )}
        <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <a href="/recuperar" className="underline hover:text-zinc-700 dark:text-zinc-300">
            Solicitar nuevo enlace
          </a>
          {" · "}
          <a href="/" className="underline hover:text-zinc-700 dark:text-zinc-300">
            Volver
          </a>
        </div>
      </div>
    </div>
  );
}
