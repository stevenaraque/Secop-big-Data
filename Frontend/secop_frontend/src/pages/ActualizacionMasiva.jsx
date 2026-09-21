import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"

// RF-26: panel ops para disparar actualizacion masiva sin duplicar.
// Origen periodica + bulk_create ignore_conflicts por id_contrato.
export default function ActualizacionMasiva({ token }) {
  const [limite, setLimite] = useState(50);
  const [offset, setOffset] = useState(0);
  const [depto, setDeptoFiltro] = useState("");
  const [fase, setFase] = useState("idle"); // idle | lanzando | polling | done | error
  const [mensaje, setMensaje] = useState("");
  const [trabajo, setTrabajo] = useState(null);
  const [ultima, setUltima] = useState(null);
  const [cargandoUltima, setCargandoUltima] = useState(true);
  const timerRef = useRef(null);

  async function cargarUltima() {
    if (!token) return;
    setCargandoUltima(true);
    try {
      const r = await fetch(`${API}/cargar/ultima-actualizacion/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("No se pudo leer ultima actualizacion.");
      const data = await r.json();
      setUltima(data);
    } catch {
      setUltima(null);
    } finally {
      setCargandoUltima(false);
    }
  }

  useEffect(() => {
    cargarUltima();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function consultarTrabajo(id) {
    const r = await fetch(`${API}/cargar/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error("No se pudo consultar el trabajo.");
    return r.json();
  }

  function detenerPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleActualizar(e) {
    e.preventDefault();
    setMensaje("");
    setTrabajo(null);
    const lim = Number(limite) || 50;
    const off = Number(offset) || 0;
    // Público 500k: SODA $limit max 50000 por request. Si piden >50000 o =500k, se pagina en 50k chunks.
    // Backend actualizar-periodica no tiene cap 1000 (solo iniciar-carga), pero validamos 1..50000 por chunk.
    if (lim < 1 || lim > 500000) {
      setFase("error");
      setMensaje("Limite debe estar entre 1 y 500000 (500k = 10×50k paginado).");
      return;
    }
    if (off < 0) {
      setFase("error");
      setMensaje("Offset no puede ser negativo.");
      return;
    }
    setFase("lanzando");
    try {
      // Si piden 500k (o >50000), pagina en bloques de 50k con offset incremental y espera cada trabajo
      if (lim > 50000) {
        const chunks = Math.ceil(lim / 50000);
        let totalNuevos = 0;
        let lastId = null;
        for (let i = 0; i < chunks; i++) {
          const chunkLim = Math.min(50000, lim - i * 50000);
          const chunkOff = off + i * 50000;
          setMensaje(`Cargando bloque ${i + 1}/${chunks} (limit ${chunkLim} offset ${chunkOff})...`);
          const r = await fetch(`${API}/cargar/actualizar-periodica/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ limit: chunkLim, offset: chunkOff, ...(depto.trim() ? { depto: depto.trim() } : {}) }),
          });
          const data = await r.json().catch(() => ({}));
          if (r.status === 401) throw new Error("Sesion vencida. Vuelve a entrar.");
          if (r.status === 403) throw new Error("Solo admin puede actualizar.");
          if (r.status === 409) throw new Error(data.detalle || "Ya hay una actualizacion en curso — espera 1s y reintenta.");
          if (!r.ok) throw new Error(data.detalle || `Bloque ${i + 1} fallo.`);
          lastId = data.id;
          // Espera a que este bloque complete antes del siguiente (polling 1s)
          await new Promise((resolve, reject) => {
            const iv = setInterval(async () => {
              try {
                const j = await consultarTrabajo(data.id);
                setTrabajo({ id: j.id, estado: j.estado, procesados: j.registros_procesados ?? 0, nuevos: j.nuevos_registros ?? null, total: j.total_registros ?? 0 });
                if (j.estado === "completado" || j.estado === "error") {
                  clearInterval(iv);
                  if (j.estado === "error") reject(new Error(j.mensaje_error || "Bloque fallo"));
                  else { totalNuevos += j.nuevos_registros ?? 0; resolve(); }
                }
              } catch (e) { clearInterval(iv); reject(e); }
            }, 1000);
            timerRef.current = iv;
          });
        }
        setFase("done");
        setMensaje(`Carga 500k completada en ${chunks} bloques. Total nuevos ~${totalNuevos}.`);
        setTrabajo((prev) => ({ ...prev, nuevos: totalNuevos }));
        cargarUltima();
        return;
      }
      // Caso normal 1..50000: un solo bloque
      const r = await fetch(`${API}/cargar/actualizar-periodica/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: lim,
          offset: off,
          ...(depto.trim() ? { depto: depto.trim() } : {}),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error("Sesion vencida. Vuelve a entrar.");
      if (r.status === 403)
        throw new Error("Solo admin puede actualizar. Pide acceso admin.");
      if (r.status === 409)
        throw new Error(data.detalle || "Ya hay una actualizacion en curso.");
      if (!r.ok) throw new Error(data.detalle || "No se pudo iniciar.");
      setTrabajo({ id: data.id, estado: data.estado, nuevos: null });
      setFase("polling");
      detenerPolling();
      timerRef.current = setInterval(async () => {
        try {
          const j = await consultarTrabajo(data.id);
          setTrabajo({
            id: j.id,
            estado: j.estado,
            procesados: j.procesados ?? j.registros_procesados ?? 0,
            nuevos: j.nuevos_registros ?? j.nuevos ?? null,
            total: j.total ?? j.total_registros ?? 0,
          });
          if (j.estado === "completado" || j.estado === "error") {
            detenerPolling();
            setFase(j.estado === "error" ? "error" : "done");
            if (j.estado === "error") {
              setMensaje(j.mensaje_error || "La carga fallo. Revisa el log.");
            }
            cargarUltima();
          }
        } catch {
          detenerPolling();
          setFase("error");
          setMensaje("Se perdio el seguimiento. Consulta el trabajo manual.");
        }
      }, 1000);
    } catch (err) {
      detenerPolling();
      setFase("error");
      setMensaje(err.message);
    }
  }

  async function handleCargar500k() {
    // Carga 500k en 10 bloques de 50k con offset incremental, sin depender del state limite (evita async setState)
    if (!token) { setFase("error"); setMensaje("Necesitas login admin para cargar 500k."); return; }
    setFase("lanzando");
    setMensaje("Iniciando 500k (10×50k) desde offset 10000 — ~3 min, no cierres la pestaña...");
    const totalBloques = 10;
    const baseOffset = 10000;
    let totalNuevos = 0;
    try {
      for (let i = 0; i < totalBloques; i++) {
        const chunkLim = 50000;
        const chunkOff = baseOffset + i * 50000;
        setMensaje(`Bloque ${i + 1}/${totalBloques} limit ${chunkLim} offset ${chunkOff} — cargando...`);
        const r = await fetch(`${API}/cargar/actualizar-periodica/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ limit: chunkLim, offset: chunkOff, ...(depto.trim() ? { depto: depto.trim() } : {}) }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.status === 401) throw new Error("Sesion vencida. Vuelve a entrar.");
        if (r.status === 403) throw new Error("Solo admin puede actualizar.");
        if (r.status === 409) {
          // Espera y reintenta este bloque
          await new Promise((res) => setTimeout(res, 2000));
          i--; continue;
        }
        if (!r.ok) throw new Error(data.detalle || `Bloque ${i + 1} fallo.`);
        // Espera completado con polling 1s
        await new Promise((resolve, reject) => {
          const iv = setInterval(async () => {
            try {
              const j = await consultarTrabajo(data.id);
              setTrabajo({ id: j.id, estado: j.estado, procesados: j.registros_procesados ?? 0, nuevos: j.nuevos_registros ?? null, total: j.total_registros ?? 0 });
              if (j.estado === "completado" || j.estado === "error") {
                clearInterval(iv);
                timerRef.current = null;
                if (j.estado === "error") reject(new Error(j.mensaje_error || "Bloque fallo"));
                else { totalNuevos += j.nuevos_registros ?? 0; resolve(); }
              }
            } catch (e) { clearInterval(iv); reject(e); }
          }, 1000);
          timerRef.current = iv;
        });
      }
      setFase("done");
      setMensaje(`500k completado en ${totalBloques} bloques. Total nuevos ${totalNuevos}. Refresca dashboard.`);
      setTrabajo((prev) => ({ ...prev, nuevos: totalNuevos }));
      cargarUltima();
    } catch (err) {
      detenerPolling();
      setFase("error");
      setMensaje(err.message);
    }
  }

  const enCurso = fase === "lanzando" || fase === "polling";
  const ultimoTrabajo = ultima?.ultimo_trabajo || null;
  const config = ultima?.config || null;

  return (
    <section
      aria-label="Actualizacion masiva"
      className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Actualizacion masiva
        </h2>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          {cargandoUltima
            ? "Leyendo ultima..."
            : ultimoTrabajo
              ? `Ultima ${ultimoTrabajo.estado} · nuevos ${ultimoTrabajo.nuevos_registros ?? 0}`
              : "Sin trabajos aun"}
        </p>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-[70ch] leading-relaxed">
        Trae bloques nuevos desde datos.gov.co sin duplicar por id_contrato.
        Solo admin. El progreso se consulta cada 1s.
      </p>

      <form
        onSubmit={handleActualizar}
        className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3"
      >
        <label
          htmlFor="act-limite"
          className="block text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400"
        >
          Limite
          <input
            id="act-limite"
            type="number"
            min={1}
            max={500000}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            disabled={enCurso}
            className="mt-1 w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          />
        </label>
        <label
          htmlFor="act-offset"
          className="block text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400"
        >
          Offset
          <input
            id="act-offset"
            type="number"
            min={0}
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
            disabled={enCurso}
            className="mt-1 w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          />
        </label>
        <label
          htmlFor="act-depto"
          className="block text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400"
        >
          Depto opcional
          <input
            id="act-depto"
            type="text"
            value={depto}
            onChange={(e) => setDeptoFiltro(e.target.value)}
            disabled={enCurso}
            placeholder="Boyaca"
            className="mt-1 w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={enCurso}
            className="w-full h-9 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {enCurso ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCargar500k}
            disabled={enCurso}
            className="w-full h-9 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            title="10×50k = 500k desde offset 10000 (paginado SODA $limit 50k)"
          >
            Cargar 500k
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4">
        {enCurso && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 tabular-nums">
              Trabajo {trabajo?.id ?? ""} · {trabajo?.estado ?? "lanzando"} ·
              procesados {trabajo?.procesados ?? 0}
            </p>
            <div className="mt-2 h-2 rounded bg-zinc-200 overflow-hidden">
              <div className="h-full w-1/2 bg-emerald-600 animate-pulse" />
            </div>
          </div>
        )}
        {fase === "done" && trabajo && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="px-4 py-3 flex items-baseline justify-between gap-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Nuevos registros</p>
              <p className="font-mono text-2xl tracking-tighter">
                {trabajo.nuevos ?? 0}
              </p>
            </div>
            <div className="px-4 py-2 flex items-baseline justify-between gap-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Estado final</p>
              <p className="text-xs font-medium tabular-nums">
                {trabajo.estado} · id {trabajo.id}
              </p>
            </div>
          </div>
        )}
        {fase === "error" && mensaje && (
          <p
            role="alert"
            className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2"
          >
            {mensaje}
          </p>
        )}
        {!enCurso && fase !== "done" && fase !== "error" && config && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            Intervalo {config.intervalo_horas}h · activo{" "}
            {String(config.activo)} ·{" "}
            {config.ultima_ejecucion
              ? `ultima ${config.ultima_ejecucion}`
              : "sin ejecucion"}
          </p>
        )}
      </div>
    </section>
  );
}
