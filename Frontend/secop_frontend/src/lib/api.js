// lib/api.js — único punto de acceso al backend.
// Por qué: 19 archivos repetían `VITE_API_URL || localhost`. Un cambio de URL rompía prod.
// Uso: import { API_URL, authFetch, getToken } from "../lib/api.js"

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export function getToken() {
  return localStorage.getItem("access");
}

function buildUrl(path, params) {
  const base = path.startsWith("http") ? path : `${API_URL}${path}`;
  if (!params) return base;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

// fetch con JWT + timeout 15s + mensajes de error útiles.
// No hace logout global: eso lo hace el interceptor de main.jsx solo para /api (no login).
export async function authFetch(path, { params, token, timeoutMs = 15000, ...init } = {}) {
  const t = token ?? getToken();
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(buildUrl(path, params), {
      ...init,
      signal: ctrl.signal,
      headers: {
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(init.headers || {}),
      },
    });
    if (!r.ok) {
      let detalle = `HTTP ${r.status}`;
      try {
        const j = await r.clone().json();
        detalle = j.detalle || j.detail || j.error || JSON.stringify(j).slice(0, 200);
      } catch {
        try {
          const txt = await r.clone().text();
          if (txt) detalle = txt.slice(0, 200);
        } catch {
          /* conserva HTTP status */
        }
      }
      const e = new Error(detalle);
      e.status = r.status;
      e.url = path;
      throw e;
    }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return r.json();
    return r;
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("Tiempo de espera agotado (15s). Revisa backend /api.");
      e.status = 408;
      e.url = path;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}
