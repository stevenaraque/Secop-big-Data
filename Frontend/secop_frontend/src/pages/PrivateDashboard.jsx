import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import StatusMark from "../components/StatusMark.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import PageBackground from "../components/PageBackground.jsx";
import { ArrowLeft, PencilSimple, Trash, Pause, Play, CaretLeft, CaretRight } from "@phosphor-icons/react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"
const PAGE_RADARES = 4;
const PAGE_OPOS = 5;

async function fetchRadares(token) {
  const r = await fetch(`${API}/radares/`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("radares");
  const j = await r.json();
  return j.results ?? j.value ?? j;
}
async function fetchOpos(token, estado) {
  const q = estado ? `?estado=${estado}` : "";
  const r = await fetch(`${API}/mis-oportunidades/${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("oportunidades");
  const j = await r.json();
  return j;
}

// DRF devuelve {"campo": ["msg"]} — lo vuelve texto legible en vez de JSON crudo
function detalleError(j, fallback) {
  if (!j || typeof j !== "object") return fallback;
  const partes = [];
  for (const [k, v] of Object.entries(j)) {
    const m = Array.isArray(v) ? v.join(" ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    partes.push(`${k}: ${m}`);
  }
  return (partes.join(" · ") || fallback).slice(0, 220);
}

const FORM_VACIO = { departamento_objetivo: "Boyaca", palabras_clave: "", rango_cuantia_min: "", rango_cuantia_max: "", ciudad: "", modalidad: "", filtros_extras: "" };

export default function PrivateDashboard({ token }) {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState("");
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmBorrar, setConfirmBorrar] = useState(null);
  const [pagRadares, setPagRadares] = useState(0);
  const [pagOpos, setPagOpos] = useState(0);

  const { data: radaresData, isLoading: cargandoRadares, isError: errorRadares, refetch: reintentarRadares } = useQuery({ queryKey: ["radares"], queryFn: () => fetchRadares(token), enabled: !!token, staleTime: 1000 * 60 * 5 });
  const radares = Array.isArray(radaresData) ? radaresData : radaresData?.results ?? [];
  const totalPagRadares = Math.max(1, Math.ceil(radares.length / PAGE_RADARES));
  const pagRadaresOk = Math.min(pagRadares, totalPagRadares - 1);
  const radaresPag = radares.slice(pagRadaresOk * PAGE_RADARES, pagRadaresOk * PAGE_RADARES + PAGE_RADARES);

  const { data: oposData, isLoading: cargandoOpos, isError: errorOpos, refetch: reintentarOpos } = useQuery({
    queryKey: ["oportunidades", filtroEstado],
    queryFn: () => fetchOpos(token, filtroEstado),
    enabled: !!token,
    // P1: conserva bandeja al cambiar filtro estado.
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
  const oportunidades = oposData?.results ?? oposData?.value ?? (Array.isArray(oposData) ? oposData : []);
  const totalPagOpos = Math.max(1, Math.ceil(oportunidades.length / PAGE_OPOS));
  const pagOposOk = Math.min(pagOpos, totalPagOpos - 1);
  const oposPag = oportunidades.slice(pagOposOk * PAGE_OPOS, pagOposOk * PAGE_OPOS + PAGE_OPOS);

  function armarPayload() {
    let extras = {};
    if (form.filtros_extras.trim()) {
      try {
        extras = JSON.parse(form.filtros_extras);
      } catch {
        return { error: 'Filtros avanzados: JSON inválido. Ej: {"orden": "1"}' };
      }
    }
    // Atajos Ciudad/Modalidad se funden con el JSON avanzado (avanzado gana)
    const merged = {
      ...(form.ciudad.trim() ? { ciudad: form.ciudad.trim() } : {}),
      ...(form.modalidad.trim() ? { modalidad: form.modalidad.trim() } : {}),
      ...extras,
    };
    return {
      payload: {
        departamento_objetivo: form.departamento_objetivo.trim(),
        palabras_clave: form.palabras_clave.trim(),
        rango_cuantia_min: form.rango_cuantia_min ? Number(form.rango_cuantia_min) : null,
        rango_cuantia_max: form.rango_cuantia_max ? Number(form.rango_cuantia_max) : null,
        filtros_extras: merged,
      },
    };
  }

  const crearRadar = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch(`${API}/radares/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(detalleError(await r.json().catch(() => ({})), "No se pudo crear el radar."));
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radares"] });
      setForm(FORM_VACIO);
      toast.success("Radar creado — los matches llegan con el próximo ETL.");
    },
    onError: (e) => toast.error(e.message),
  });

  const guardarEdicion = useMutation({
    mutationFn: async ({ id, payload }) => {
      const r = await fetch(`${API}/radares/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(detalleError(await r.json().catch(() => ({})), "No se pudo guardar."));
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radares"] });
      setEditandoId(null);
      setForm(FORM_VACIO);
      toast.success("Radar actualizado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const alternarActivo = useMutation({
    mutationFn: async ({ id, activo }) => {
      const r = await fetch(`${API}/radares/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activo }),
      });
      if (!r.ok) throw new Error("No se pudo cambiar el estado.");
      return r.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["radares"] });
      toast.success(v.activo ? "Radar activado." : "Radar pausado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const borrarRadar = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`${API}/radares/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("No se pudo eliminar.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radares"] });
      setConfirmBorrar(null);
      toast.success("Radar eliminado.");
    },
    onError: (e) => {
      setConfirmBorrar(null);
      toast.error(e.message);
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }) => {
      const r = await fetch(`${API}/mis-oportunidades/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado }),
      });
      if (!r.ok) throw new Error("No se pudo actualizar");
      return r.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["oportunidades"] });
      toast.success(v.estado === "Postulado" ? "Marcada como postulada." : "Guardada en tu bandeja.");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCrear(e) {
    e.preventDefault();
    const { error, payload } = armarPayload();
    if (error) {
      toast.error(error);
      return;
    }
    if (editandoId) guardarEdicion.mutate({ id: editandoId, payload });
    else crearRadar.mutate(payload);
  }

  function empezarEdicion(r) {
    setConfirmBorrar(null);
    setEditandoId(r.id);
    setForm({
      departamento_objetivo: r.departamento_objetivo ?? "Boyaca",
      palabras_clave: r.palabras_clave ?? "",
      rango_cuantia_min: r.rango_cuantia_min ?? "",
      rango_cuantia_max: r.rango_cuantia_max ?? "",
      ciudad: r.filtros_extras?.ciudad ?? "",
      modalidad: r.filtros_extras?.modalidad ?? "",
      filtros_extras: JSON.stringify(
        Object.fromEntries(Object.entries(r.filtros_extras ?? {}).filter(([k]) => k !== "ciudad" && k !== "modalidad")),
      ),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
  }

  // mapeo estado -> StatusMark
  function statusForOpo(estado) {
    if (estado === "Nueva") return "running";
    if (estado === "Guardada") return "done";
    if (estado === "Postulado") return "done";
    return "pending";
  }

  const guardando = crearRadar.isPending || guardarEdicion.isPending;

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased relative isolate">
      <PageBackground opacityDark={0.7} opacityLight={0.65} />
      <Toaster richColors closeButton position="bottom-left" />
      <header className="sticky top-0 z-10 bg-white dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 grid place-items-center text-[11px] font-mono">PR</div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight">Escritorio privado</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Radares + bandeja • SaaS Freemium</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/" className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1"><ArrowLeft size={14} aria-hidden="true" /> Público</a>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold tracking-tight">{editandoId ? "Editar Radar" : "Nuevo Radar"}</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Tus preferencias — 85 cols elegibles via JSON</p>
            <form onSubmit={handleCrear} className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Departamento
                <input value={form.departamento_objetivo} onChange={(e) => setForm({ ...form, departamento_objetivo: e.target.value })} placeholder="Boyaca" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100" />
              </label>
              <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Palabras clave *
                <input value={form.palabras_clave} onChange={(e) => setForm({ ...form, palabras_clave: e.target.value })} placeholder="pavimento" required className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Min
                  <input type="number" min={0} value={form.rango_cuantia_min} onChange={(e) => setForm({ ...form, rango_cuantia_min: e.target.value })} placeholder="5000000" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm font-mono text-zinc-900 dark:text-zinc-100" />
                </label>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Max
                  <input type="number" min={0} value={form.rango_cuantia_max} onChange={(e) => setForm({ ...form, rango_cuantia_max: e.target.value })} placeholder="30000000" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm font-mono text-zinc-900 dark:text-zinc-100" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Ciudad
                  <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Sogamoso" list="ciudades-sugeridas" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100" />
                </label>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Modalidad
                  <input value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })} placeholder="Licitación pública" list="modalidades-sugeridas" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100" />
                </label>
              </div>
              <datalist id="ciudades-sugeridas">
                <option value="Sogamoso" />
                <option value="Duitama" />
                <option value="Tunja" />
              </datalist>
              <datalist id="modalidades-sugeridas">
                <option value="Licitación pública" />
                <option value="Contratación directa" />
                <option value="Selección abreviada" />
                <option value="Concurso de méritos" />
              </datalist>
              <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-300">Filtros avanzados (JSON)
                <input value={form.filtros_extras} onChange={(e) => setForm({ ...form, filtros_extras: e.target.value })} placeholder='{"orden":"1"}' className="mt-1 w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs font-mono text-zinc-900 dark:text-zinc-100" />
              </label>
              <div className="flex gap-2">
                <button disabled={guardando} className="flex-1 h-9 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
                  {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear Radar"}
                </button>
                {editandoId && (
                  <button type="button" onClick={cancelarEdicion} className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Cancelar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Los matches llegan con el próximo ETL, + aviso al correo.</p>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold">Mis Radares ({radares.length})</h3>
            {cargandoRadares && (
              <div className="mt-3 space-y-2" aria-label="Cargando radares">
                {[0, 1].map((i) => <div key={i} className="h-[68px] rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}
              </div>
            )}
            {errorRadares && (
              <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-xs text-red-700 dark:text-red-300">No se pudieron cargar tus radares.</p>
                <button onClick={() => reintentarRadares()} className="mt-2 h-8 px-3 rounded-full bg-red-600 text-white text-xs hover:bg-red-700">Reintentar</button>
              </div>
            )}
            {!cargandoRadares && !errorRadares && (
              <>
                <div className="mt-3 space-y-2">
                  {radaresPag.map((r) => (
                    <div key={r.id} className={`rounded-xl border p-3 ${editandoId === r.id ? "border-emerald-500 ring-1 ring-emerald-500/40" : "border-zinc-200 dark:border-zinc-700"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-2">
                            <StatusMark status={r.activo ? "running" : "pending"} size={16} />
                            {r.palabras_clave}
                          </p>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono truncate">{r.departamento_objetivo} · {r.rango_cuantia_min ?? "—"} - {r.rango_cuantia_max ?? "—"}</p>
                          {r.filtros_extras && Object.keys(r.filtros_extras).length > 0 && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{JSON.stringify(r.filtros_extras)}</p>
                          )}
                        </div>
                        <span className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${r.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"}`}>{r.activo ? "Activo" : "Pausado"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button title={r.activo ? "Pausar" : "Activar"} aria-label={r.activo ? `Pausar radar ${r.palabras_clave}` : `Activar radar ${r.palabras_clave}`} disabled={alternarActivo.isPending} onClick={() => alternarActivo.mutate({ id: r.id, activo: !r.activo })} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
                          {r.activo ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                        </button>
                        <button title="Editar" aria-label={`Editar radar ${r.palabras_clave}`} onClick={() => empezarEdicion(r)} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          <PencilSimple size={13} aria-hidden="true" />
                        </button>
                        {confirmBorrar === r.id ? (
                          <button onClick={() => borrarRadar.mutate(r.id)} disabled={borrarRadar.isPending} className="h-7 px-3 rounded-full bg-red-600 text-white text-[11px] font-medium hover:bg-red-700 disabled:opacity-50">
                            {borrarRadar.isPending ? "Borrando..." : "Confirmar"}
                          </button>
                        ) : (
                          <button title="Eliminar" aria-label={`Eliminar radar ${r.palabras_clave}`} onClick={() => setConfirmBorrar(r.id)} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800">
                            <Trash size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {radares.length === 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">Aún no tienes Radares. Crea uno arriba.</p>}
                </div>
                {radares.length > PAGE_RADARES && (
                  <nav aria-label="Paginación de radares" className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">Pág {pagRadaresOk + 1}/{totalPagRadares}</p>
                    <div className="flex gap-1">
                      <button aria-label="Radares anteriores" disabled={pagRadaresOk === 0} onClick={() => setPagRadares(pagRadaresOk - 1)} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"><CaretLeft size={14} aria-hidden="true" /></button>
                      <button aria-label="Radares siguientes" disabled={pagRadaresOk >= totalPagRadares - 1} onClick={() => setPagRadares(pagRadaresOk + 1)} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"><CaretRight size={14} aria-hidden="true" /></button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Bandeja de Oportunidades</h2>
              <span className="text-[11px] px-2 py-1 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono">{oportunidades.length} total</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {["", "Nueva", "Guardada", "Postulado"].map((est) => (
                <button
                  key={est || "todas"}
                  onClick={() => { setFiltroEstado(est); setPagOpos(0); }}
                  aria-pressed={filtroEstado === est}
                  className={`h-7 px-3 rounded-full text-xs border ${filtroEstado === est ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                >
                  {est || "Todas"}
                </button>
              ))}
            </div>

            {cargandoOpos && !oportunidades.length && (
              <div className="mt-4 space-y-3" aria-label="Cargando oportunidades">
                {[0, 1, 2].map((i) => <div key={i} className="h-[92px] rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}
              </div>
            )}
            {errorOpos && !oportunidades.length && (
              <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
                <p className="text-sm text-red-700 dark:text-red-300">No se pudo cargar tu bandeja.</p>
                <button onClick={() => reintentarOpos()} className="mt-2 h-8 px-3 rounded-full bg-red-600 text-white text-xs hover:bg-red-700">Reintentar</button>
              </div>
            )}
            {!cargandoOpos && !errorOpos && (
              <>
                <div className="mt-4 space-y-3">
                  {oposPag.map((op) => (
                    <div key={op.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 flex items-start gap-3">
                      <StatusMark status={statusForOpo(op.estado)} label={op.estado} size={20} doneColor={op.estado === "Postulado" ? "#0ea5e9" : "#22c55e"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{op.contrato?.id_contrato} · {op.contrato?.departamento} — {op.contrato?.modalidad}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{op.contrato?.descripcion_del_proceso?.slice(0, 80) || op.contrato?.nombre_entidad}</p>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">${Number(op.contrato?.valor_contrato || 0).toLocaleString("es-CO")} · {op.contrato?.fecha_firma?.slice(0, 10) || ""}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Radar: {op.radar_palabras} · {op.creado_en ? new Date(op.creado_en).toLocaleString("es-CO") : "—"}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {op.estado === "Nueva" && (
                          <>
                            <button disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate({ id: op.id, estado: "Guardada" })} className="h-7 px-3 rounded-full bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-50">Guardar</button>
                            <button disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate({ id: op.id, estado: "Postulado" })} className="h-7 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">Postular</button>
                          </>
                        )}
                        {op.estado === "Guardada" && (
                          <button disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate({ id: op.id, estado: "Postulado" })} className="h-7 px-3 rounded-full bg-sky-600 text-white text-xs hover:bg-sky-700 disabled:opacity-50">Postular</button>
                        )}
                        {op.estado === "Postulado" && <span className="text-[11px] px-2 py-1 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900">Postulado</span>}
                      </div>
                    </div>
                  ))}
                  {oportunidades.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400 border border-dashed rounded-xl p-6 text-center">Sin oportunidades para este filtro. Crea un Radar y espera al próximo ETL.</p>}
                </div>
                {oportunidades.length > PAGE_OPOS && (
                  <nav aria-label="Paginación de oportunidades" className="mt-4 flex items-center justify-between">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">Pág {pagOposOk + 1}/{totalPagOpos} · {oportunidades.length} en bandeja</p>
                    <div className="flex gap-1">
                      <button aria-label="Oportunidades anteriores" disabled={pagOposOk === 0} onClick={() => setPagOpos(pagOposOk - 1)} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"><CaretLeft size={14} aria-hidden="true" /></button>
                      <button aria-label="Oportunidades siguientes" disabled={pagOposOk >= totalPagOpos - 1} onClick={() => setPagOpos(pagOposOk + 1)} className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"><CaretRight size={14} aria-hidden="true" /></button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
