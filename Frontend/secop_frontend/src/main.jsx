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

// P0: 401 global para /api. Qué: limpia JWT muerto y manda a /login. Por qué: solo 1 de 15 páginas lo manejaba.
const _fetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const r = await _fetch(...args);
  try {
    const url = String(args[0]?.url ?? args[0] ?? "");
    if (r.status === 401 && url.includes("/api/") && !url.includes("/api/auth/login/")) {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
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
