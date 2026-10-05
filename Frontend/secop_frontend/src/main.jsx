import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    // P0: 1 reintento (no 3) + sin refetch agresivo. Qué: evita tormenta 401 con token expirado 1h.
    // Fix 429: no reintentar en 429 (throttle anon 200/min aún puede saturar con 10 req por clic), deja que TanStack muestre error sin duplicar.
    queries: { retry: (failureCount, error) => (error?.status === 429 ? false : failureCount < 1), refetchOnWindowFocus: false },
  },
});

// P0: 401 global para /api con refresh antes de expulsar. Qué: intenta 1 refresh
// (single-flight) y reintenta la petición original; solo si falla limpia y va a /login.
const _fetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const r = await _fetch(...args);
  try {
    const url = String(args[0]?.url ?? args[0] ?? "");
    const esAuth = url.includes("/api/auth/login/") || url.includes("/api/auth/register/") || url.includes("/api/auth/token/refresh/");
    if (r.status === 401 && url.includes("/api/") && !esAuth) {
      const { refreshAccess, doLogout } = await import("./lib/api.js");
      const nuevo = await refreshAccess();
      if (nuevo) {
        const init = { ...(args[1] || {}) };
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${nuevo}` };
        return _fetch(args[0], init);
      }
      doLogout();
    }
  } catch {
    /* noop: nunca romper el fetch */
  }
  return r;
};
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
