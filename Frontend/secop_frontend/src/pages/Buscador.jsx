import { useEffect, useRef, useState } from "react";

const API = "http://127.0.0.1:8000/api";

export default function Buscador({ token }) {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const abortRef = useRef(null);

  // debounce 300ms: espera a que dejes de escribir
  useEffect(() => {
    if (texto.trim().length < 2) {
      setQ("");
      setDatos(null);
      return;
    }
    const t = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  // abort: cancela la petición anterior si escribes de nuevo
  useEffect(() => {
    if (q.length < 2 || !token) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCargando(true);
    fetch(`${API}/buscar/?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Error buscar");
        return r.json();
      })
      .then((j) => setDatos(j))
      .catch((e) => {
        if (e.name !== "AbortError") setDatos(null);
      })
      .finally(() => setCargando(false));
    return () => ctrl.abort();
  }, [q, token]);

  return (
    <section
      aria-label="Búsqueda global"
      className="rounded-2xl border border-zinc-200 bg-white p-5"
    >
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar contratos, empresas y entidades…"
        className="w-full h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
      />
      {cargando && <p className="mt-2 text-xs text-zinc-500">Buscando…</p>}
      {!cargando &&
        q.length >= 2 &&
        datos &&
        datos.contratos.length === 0 &&
        datos.empresas.length === 0 &&
        datos.entidades.length === 0 && (
          <p className="mt-2 text-sm text-zinc-600">
            Sin resultados para “{q}”. Prueba con otro texto.
          </p>
        )}
      {datos && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Contratos · {datos.contratos.length}
            </h3>
            {datos.contratos.map((c) => (
              <p key={c.id_contrato} className="mt-1 tabular-nums">
                {c.id_contrato} — {c.contratista_nombre}
              </p>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Empresas · {datos.empresas.length}
            </h3>
            {datos.empresas.map((e) => (
              <p key={e.contratista_nit} className="mt-1">
                {e.contratista_nombre} · {e.total}
              </p>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Entidades · {datos.entidades.length}
            </h3>
            {datos.entidades.map((e) => (
              <p key={e.nombre_entidad} className="mt-1">
                {e.nombre_entidad} · {e.total}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
