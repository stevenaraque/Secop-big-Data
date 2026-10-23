// lib/api.js — único punto de acceso al backend.
// Por qué: 19 archivos repetían `VITE_API_URL || localhost`. Un cambio de URL rompía prod.
// Uso: import { API_URL, authFetch, getToken } from "../lib/api.js"

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export function getToken() {
  return localStorage.getItem("access");
}

// P0: exp local sin pedir al backend. Margen 30s para no usar un token que muere en vuelo.
export function tokenExpirado(t, margenMs = 30000) {
  if (!t) return true;
  try {
    const exp = JSON.parse(atob(t.split(".")[1])).exp;
    if (!exp) return true;
    return exp * 1000 < Date.now() + margenMs;
  } catch {
    return true;
  }
}

// P0: token vivo o null. Con expirado intenta 1 refresh single-flight; si falla → null (anon), nunca token muerto.
export async function obtenerTokenVigente(t) {
  if (!t) return null;
  if (!tokenExpirado(t)) return t;
  const res = await refreshAccess();
  return res.access;
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
// Devuelve { access, definitivo }:
//   access     → token nuevo, o null
//   definitivo → true  = el backend RECHAZÓ el refresh (400/401/403) → cerrar sesión
//                false = red/timeout/5xx → transitorio, NO destruir la sesión
// Antes devolvía null en ambos casos y un parpadeo de red de 2s expulsaba al usuario.
let _refreshPromise = null;
export function refreshAccess({ timeoutMs = 15000 } = {}) {
  if (_refreshPromise) return _refreshPromise;
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return Promise.resolve({ access: null, definitivo: true });
  _refreshPromise = (async () => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const rechazado = r.status === 400 || r.status === 401 || r.status === 403;
        return { access: null, definitivo: rechazado };
      }
      const data = await r.json().catch(() => ({}));
      if (!data.access) return { access: null, definitivo: false };
      localStorage.setItem("access", data.access);
      if (data.refresh) localStorage.setItem("refresh", data.refresh);
      return { access: data.access, definitivo: false };
    } catch {
      // AbortError (timeout) o TypeError (red caída): transitorio.
      return { access: null, definitivo: false };
    } finally {
      clearTimeout(id);
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}
