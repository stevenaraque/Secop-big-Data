import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StatusMark from "../components/StatusMark.jsx";

const API = "http://127.0.0.1:8000/api";

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

export default function PrivateDashboard({ token }) {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState("");
  const [form, setForm] = useState({ departamento_objetivo: "Boyaca", palabras_clave: "", rango_cuantia_min: "", rango_cuantia_max: "", filtros_extras: "" });
  const [msg, setMsg] = useState("");

  const { data: radaresData } = useQuery({ queryKey: ["radares"], queryFn: () => fetchRadares(token), enabled: !!token });
  const radares = Array.isArray(radaresData) ? radaresData : radaresData?.results ?? [];

  const { data: oposData } = useQuery({
    queryKey: ["oportunidades", filtroEstado],
    queryFn: () => fetchOpos(token, filtroEstado),
    enabled: !!token,
  });
  const oportunidades = oposData?.results ?? oposData?.value ?? oposData ?? [];
  const count = oposData?.count ?? oportunidades.length;

  const crearRadar = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch(`${API}/radares/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || JSON.stringify(j));
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radares"] });
      setMsg("Radar creado");
      setTimeout(() => setMsg(""), 2000);
    },
    onError: (e) => setMsg(String(e.message).slice(0, 80)),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oportunidades"] }),
  });

  function handleCrear(e) {
    e.preventDefault();
    let extras = {};
    if (form.filtros_extras.trim()) {
      try {
        extras = JSON.parse(form.filtros_extras);
      } catch {
        setMsg("filtros_extras debe ser JSON valido ej. {\"ciudad\":\"Sogamoso\"}");
        return;
      }
    }
    crearRadar.mutate({
      departamento_objetivo: form.departamento_objetivo,
      palabras_clave: form.palabras_clave,
      rango_cuantia_min: form.rango_cuantia_min ? Number(form.rango_cuantia_min) : null,
      rango_cuantia_max: form.rango_cuantia_max ? Number(form.rango_cuantia_max) : null,
      filtros_extras: extras,
    });
  }

  // mapeo estado -> StatusMark
  function statusForOpo(estado) {
    if (estado === "Nueva") return "running";
    if (estado === "Guardada") return "done";
    if (estado === "Postulado") return "done";
    return "pending";
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] text-zinc-900 antialiased">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white grid place-items-center text-[11px] font-mono">PR</div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight">Escritorio privado</p>
              <p className="text-[11px] text-zinc-600">Radares + bandeja • SaaS Freemium</p>
            </div>
          </div>
          <a href="/" className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 hover:bg-zinc-50">← Público</a>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold tracking-tight">Nuevo Radar</h2>
            <p className="text-xs text-zinc-600 mt-1">Tus preferencias — 85 cols elegibles via JSON</p>
            <form onSubmit={handleCrear} className="mt-4 space-y-3">
              <label className="block text-xs font-medium">Departamento
                <input value={form.departamento_objetivo} onChange={(e) => setForm({ ...form, departamento_objetivo: e.target.value })} placeholder="Boyaca" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-sm" />
              </label>
              <label className="block text-xs font-medium">Palabras clave *
                <input value={form.palabras_clave} onChange={(e) => setForm({ ...form, palabras_clave: e.target.value })} placeholder="pavimento" required className="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium">Min
                  <input type="number" value={form.rango_cuantia_min} onChange={(e) => setForm({ ...form, rango_cuantia_min: e.target.value })} placeholder="5000000" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-sm font-mono" />
                </label>
                <label className="block text-xs font-medium">Max
                  <input type="number" value={form.rango_cuantia_max} onChange={(e) => setForm({ ...form, rango_cuantia_max: e.target.value })} placeholder="30000000" className="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-sm font-mono" />
                </label>
              </div>
              <label className="block text-xs font-medium">Filtros 85 cols (JSON)
                <input value={form.filtros_extras} onChange={(e) => setForm({ ...form, filtros_extras: e.target.value })} placeholder='{"ciudad":"Sogamoso"}' className="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-xs font-mono" />
              </label>
              <button disabled={crearRadar.isPending} className="w-full h-9 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
                {crearRadar.isPending ? "Creando..." : "Crear Radar"}
              </button>
              {msg && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold">Mis Radares ({radares.length})</h3>
            <div className="mt-3 space-y-2 max-h-[320px] overflow-auto pr-1">
              {radares.map((r) => (
                <div key={r.id} className="rounded-xl border border-zinc-200 p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <StatusMark status={r.activo ? "running" : "pending"} size={16} />
                      {r.palabras_clave}
                    </p>
                    <p className="text-[11px] text-zinc-600 font-mono truncate">{r.departamento_objetivo} · {r.rango_cuantia_min ?? "—"} - {r.rango_cuantia_max ?? "—"}</p>
                    {r.filtros_extras && Object.keys(r.filtros_extras).length > 0 && (
                      <p className="text-[11px] text-zinc-500 font-mono truncate">{JSON.stringify(r.filtros_extras)}</p>
                    )}
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded-full border ${r.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>{r.activo ? "Activo" : "Pausado"}</span>
                </div>
              ))}
              {radares.length === 0 && <p className="text-xs text-zinc-500">Aún no tienes Radares. Crea uno arriba.</p>}
            </div>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Bandeja de Oportunidades</h2>
              <span className="text-[11px] px-2 py-1 rounded-full bg-zinc-900 text-white font-mono">{count} total</span>
            </div>
            <div className="mt-3 flex gap-1">
              {["", "Nueva", "Guardada", "Postulado"].map((est) => (
                <button
                  key={est || "todas"}
                  onClick={() => setFiltroEstado(est)}
                  className={`h-7 px-3 rounded-full text-xs border ${filtroEstado === est ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"}`}
                >
                  {est || "Todas"}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3 max-h-[600px] overflow-auto pr-1">
              {(Array.isArray(oportunidades) ? oportunidades : []).map((op) => (
                <div key={op.id} className="rounded-xl border border-zinc-200 p-4 flex items-start gap-3">
                  <StatusMark status={statusForOpo(op.estado)} label={op.estado} size={20} doneColor={op.estado === "Postulado" ? "#0ea5e9" : "#22c55e"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{op.contrato?.id_contrato} · {op.contrato?.departamento} — {op.contrato?.modalidad}</p>
                    <p className="text-xs text-zinc-600 truncate">{op.contrato?.descripcion_del_proceso?.slice(0, 80) || op.contrato?.nombre_entidad}</p>
                    <p className="text-[11px] font-mono text-zinc-500">${Number(op.contrato?.valor_contrato || 0).toLocaleString("es-CO")} · {op.contrato?.fecha_firma?.slice(0, 10) || ""}</p>
                    <p className="text-[11px] text-zinc-500">Radar: {op.radar_palabras} · {new Date(op.creado_en).toLocaleString("es-CO")}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {op.estado === "Nueva" && (
                      <>
                        <button onClick={() => cambiarEstado.mutate({ id: op.id, estado: "Guardada" })} className="h-7 px-3 rounded-full bg-emerald-600 text-white text-xs hover:bg-emerald-700">Guardar</button>
                        <button onClick={() => cambiarEstado.mutate({ id: op.id, estado: "Postulado" })} className="h-7 px-3 rounded-full border border-zinc-200 text-xs hover:bg-zinc-50">Postular</button>
                      </>
                    )}
                    {op.estado === "Guardada" && (
                      <button onClick={() => cambiarEstado.mutate({ id: op.id, estado: "Postulado" })} className="h-7 px-3 rounded-full bg-sky-600 text-white text-xs hover:bg-sky-700">Postular</button>
                    )}
                    {op.estado === "Postulado" && <span className="text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Postulado</span>}
                  </div>
                </div>
              ))}
              {oportunidades.length === 0 && <p className="text-sm text-zinc-500 border border-dashed rounded-xl p-6 text-center">Sin oportunidades para este filtro. Crea un Radar y espera al próximo ETL.</p>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
