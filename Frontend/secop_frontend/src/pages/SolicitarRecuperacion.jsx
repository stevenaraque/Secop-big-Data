import { useState } from "react";

const API = "http://127.0.0.1:8000/api";

export default function SolicitarRecuperacion() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | loading | ok | error
  const [mensaje, setMensaje] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado("loading");
    setMensaje("");
    try {
      const r = await fetch(`${API}/auth/recuperar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detalle || JSON.stringify(data));
      setEstado("ok");
      setMensaje(data.detalle);
    } catch (err) {
      setEstado("error");
      setMensaje(err.message);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] grid place-items-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Recuperar contraseña</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Escribe tu correo. Si existe, te enviaremos un enlace válido por 30 min y de un solo uso.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-zinc-700">
            Correo
            <input
              type="email"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1 w-full h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            />
          </label>
          <button
            type="submit"
            disabled={estado === "loading"}
            className="w-full h-10 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
          >
            {estado === "loading" ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>
        {estado === "ok" && (
          <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {mensaje}
          </p>
        )}
        {estado === "error" && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {mensaje}
          </p>
        )}
        <div className="mt-4 text-xs text-zinc-500">
          <a href="/" className="underline hover:text-zinc-700">
            Volver al inicio
          </a>
          {" · "}
          <span>Revisa la consola del backend (console.EmailBackend) para ver el enlace en dev.</span>
        </div>
      </div>
    </div>
  );
}
