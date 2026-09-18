import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | loading | error
  const [mensaje, setMensaje] = useState("");

  const sesionGuardada = !!localStorage.getItem("access");

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado("loading");
    setMensaje("");
    try {
      const r = await fetch(`${API}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detalle || "No se pudo iniciar sesión.");
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      window.location.href = "/";
    } catch (err) {
      setEstado("error");
      setMensaje(err.message);
    }
  }

  function usarOtraCuenta() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.reload();
  }

  // Si ya hay token guardado, ofrecer continuar o cambiar de cuenta
  // en vez de pedir la clave otra vez.
  if (sesionGuardada) {
    return (
      <div className="min-h-[100dvh] bg-[#fcfcfc] grid place-items-center p-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">Ya hay una sesión guardada</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Puedes entrar directo al dashboard o borrarla y usar otra cuenta.
          </p>
          <div className="mt-5 space-y-3">
            <a
              href="/"
              className="block text-center w-full h-10 leading-10 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.98]"
            >
              Entrar al dashboard
            </a>
            <button
              type="button"
              onClick={usarOtraCuenta}
              className="w-full h-10 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-900 hover:border-zinc-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              Usar otra cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] grid place-items-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Entra con tu correo y contraseña para ver el dashboard.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label htmlFor="login-correo" className="block text-xs font-medium text-zinc-700">
            Correo
            <input
              id="login-correo"
              type="email"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1 w-full h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            />
          </label>
          <label htmlFor="login-contrasena" className="block text-xs font-medium text-zinc-700">
            Contraseña
            <input
              id="login-contrasena"
              type="password"
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Tu contraseña"
              className="mt-1 w-full h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            />
          </label>
          <button
            type="submit"
            disabled={estado === "loading"}
            className="w-full h-10 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
          >
            {estado === "loading" ? "Entrando..." : "Entrar"}
          </button>
        </form>
        {estado === "error" && (
          <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {mensaje}
          </p>
        )}
        <div className="mt-4 text-xs text-zinc-500">
          <a href="/recuperar" className="underline hover:text-zinc-700">
            Olvidé mi contraseña
          </a>
        </div>
      </div>
    </div>
  );
}
