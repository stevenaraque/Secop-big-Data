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

// fetch con JWT + timeout 45s + mensajes de error útiles.
// 45s: los agregados fríos sobre 9.3M pueden tardar (luego van por caché/resumen).
// No hace logout global: eso lo hace el interceptor de main.jsx solo para /api (no login).
export async function authFetch(path, { params, token, timeoutMs = 45000, ...init } = {}) {
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
      const e = new Error(`Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s). Revisa backend /api.`);
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

export function doLogout(redirect = true) {
  clearSession();
  if (redirect && !window.location.pathname.startsWith("/login")) window.location.href = "/login";
}

// Refresh single-flight: todas las llamadas 401 concurrentes comparten una promesa.
let _refreshPromise = null;
export function refreshAccess() {
  if (_refreshPromise) return _refreshPromise;
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return Promise.resolve(null);
  _refreshPromise = (async () => {
    try {
      const r = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!r.ok) return null;
      const data = await r.json().catch(() => ({}));
      if (!data.access) return null;
      localStorage.setItem("access", data.access);
      if (data.refresh) localStorage.setItem("refresh", data.refresh);
      return data.access;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}
