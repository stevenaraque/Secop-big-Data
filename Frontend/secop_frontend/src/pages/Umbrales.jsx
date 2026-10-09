import { useState } from "react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { SlidersHorizontal } from "@phosphor-icons/react";
import "../components/glass-card.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

async function fetchUmbrales(token) {
  const r = await fetch(`${API}/umbrales/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error("Error umbrales")
  return r.json()
}

async function saveUmbral(nombre, valor, token) {
  const r = await fetch(`${API}/umbrales/${encodeURIComponent(nombre)}/`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ valor }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.detalle || "Error guardando umbral")
  return data
}

export default function Umbrales({ token }) {
  const qc = useQueryClient()
  // P0: key incluye modo (anon/auth) + caché 5min + conserva anterior. Sin esto el login mezcla datos entre modos.
  const modo = token ? "auth" : "anon"
  const { data, isLoading, isError, refetch: reintentar } = useQuery({
    queryKey: ["umbrales", modo],
    queryFn: () => fetchUmbrales(token),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  // Overrides del usuario. El valor visible es override ?? valor del servidor.
  // Sin useEffect: evita setState en efecto y cascadas de render.
  const [edit, setEdit] = useState({})
  const [msg, setMsg] = useState("")

  const guardar = async (nombre, valorServidor) => {
    setMsg("")
    const raw = edit[nombre] ?? valorServidor;
    try {
      await saveUmbral(nombre, Number(raw), token)
      setMsg(`Umbral ${nombre} guardado. Aplica sin reinicio.`)
      setEdit((prev) => {
        const next = { ...prev };
        delete next[nombre];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["umbrales"] })
      qc.invalidateQueries({ queryKey: ["banderas"] })
      qc.invalidateQueries({ queryKey: ["predominio"] })
    } catch (e) {
      setMsg(e.message)
    }
  }

  return (
    <section aria-label="Configuración de umbrales" className="rounded-2xl glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><SlidersHorizontal size={18} aria-hidden="true" /> Umbrales de alertas</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Se guardan en BD y aplican sin reinicio</p>
      </div>
      {isLoading && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Cargando umbrales…</p>}
      {isError && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">Error cargando umbrales.</p>
          <button onClick={() => reintentar()} className="h-8 rounded-full border border-red-300 dark:border-red-800 px-4 text-xs font-medium text-red-700 dark:text-red-300">Reintentar</button>
        </div>
      )}
      {!isLoading && !isError && data && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.umbrales.map((u) => (
            <div key={u.nombre} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
              <p className="text-sm font-medium">{u.nombre}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.descripcion}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={edit[u.nombre] ?? u.valor ?? ""}
                  onChange={(e) => setEdit({ ...edit, [u.nombre]: e.target.value })}
                  className="w-24 h-9 rounded-lg border border-zinc-200 px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                />
                <button
                  onClick={() => guardar(u.nombre, u.valor)}
                  className="h-9 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 text-sm text-white dark:text-zinc-900 active:scale-[0.98]"
                >
                  Guardar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{msg}</p>}
    </section>
  )
}
