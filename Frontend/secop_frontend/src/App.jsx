import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";

// Lazy por ruta: recharts/leaflet/graph no entran al chunk inicial.
// Sin espera artificial: PantallaCarga (Suspense) ya cubre el hueco sin sumar 800ms.
const DashboardModern = lazy(() => import("./pages/DashboardModern.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Registro = lazy(() => import("./pages/Registro.jsx"));
const SolicitarRecuperacion = lazy(
  () => import("./pages/SolicitarRecuperacion.jsx"),
);
const Restablecer = lazy(() => import("./pages/Restablecer.jsx"));
const PrivateDashboard = lazy(() => import("./pages/PrivateDashboard.jsx"));
import PantallaCarga from "./components/PantallaCarga.jsx";
import PageBackground from "./components/PageBackground.jsx";

// Scroll arriba al cambiar de ruta (SPA: el navegador ya no lo hace solo).
function ScrollArriba() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

// Fondo único: misma instancia siempre (sin remount = sin flash WebGL).
// Intensidad por ruta sin desmontar: /app usa la sutil de PrivateDashboard.
function FondoPersistente() {
  const { pathname } = useLocation();
  const suave = pathname.startsWith("/app");
  return <PageBackground opacityDark={suave ? 0.7 : 0.85} opacityLight={suave ? 0.65 : 0.8} />;
}

// RNF-11: skip link para teclado — Qué: Tab salta a contenido. Por qué: WCAG 2.4.1
function SkipLink() {
  return (
    <a href="#contenido" className="skip-link">
      Saltar al contenido
    </a>
  );
}

function PublicDashboardRoute() {
  // Público real: observatorio sin login — AllowAny en backend, token opcional. SaaS privado sigue en /app con PrivateRoute.
  const token = localStorage.getItem("access"); // null si anonimo, dashboard funciona igual (agregados <50KB)
  return (
    <>
      <SkipLink />
      <DashboardModern token={token} />
    </>
  );
}

function PrivateRoute() {
  // P1-5: valida exp del access antes de pintar privado (antes solo existencia → flash con token expirado).
  // Si expiró, intenta 1 refresh single-flight; solo si falla expulsa a /login.
  const [estado, setEstado] = useState(() => {
    const t = localStorage.getItem("access");
    if (!t) return "no";
    try {
      const exp = JSON.parse(atob(t.split(".")[1])).exp;
      if (!exp || exp * 1000 < Date.now()) return "revisar";
      return "ok";
    } catch {
      return "revisar";
    }
  });
  useEffect(() => {
    if (estado !== "revisar") return;
    let vivo = true;
    (async () => {
      try {
        const { refreshAccess } = await import("./lib/api.js");
        const nuevo = await refreshAccess();
        if (vivo) setEstado(nuevo ? "ok" : "no");
      } catch {
        if (vivo) setEstado("no");
      }
    })();
    return () => { vivo = false; };
  }, [estado]);
  if (estado === "no") return <Navigate to="/login" replace />;
  if (estado === "revisar") return <PantallaCarga />;
  const token = localStorage.getItem("access");
  return (
    <>
      <SkipLink />
      <PrivateDashboard token={token} />
    </>
  );
}

function App() {
  // P0-2: prefetch crítico tras idle — Login/Registro precargan PrivateDashboard/DashboardModern para /app instantáneo, no bloquea FCP
  useEffect(() => {
    const prefetch = () => {
      import("./pages/PrivateDashboard.jsx");
      import("./pages/DashboardModern.jsx");
      import("./pages/Registro.jsx");
    };
    if ("requestIdleCallback" in window)
      requestIdleCallback(prefetch, { timeout: 2500 });
    else setTimeout(prefetch, 1800);
  }, []);

  return (
    <BrowserRouter>
      {/* Layout persistente: isolate propio para que el fondo -z-10 quede visible;
          las páginas usan fondo transparente y el metal pinta la base */}
      <div className="relative isolate min-h-[100dvh]">
        <ScrollArriba />
        <FondoPersistente />
        <Toaster richColors closeButton position="bottom-left" toastOptions={{ style: { fontFamily: "Geist, system-ui, sans-serif" } }} />
        <Suspense fallback={<PantallaCarga />}>
          <div className="relative">
          <Routes>
          <Route
            path="/login"
            element={
              <>
                <SkipLink />
                <Login />
              </>
            }
          />
          <Route
            path="/registro"
            element={
              <>
                <SkipLink />
                <Registro />
              </>
            }
          />
          <Route
            path="/recuperar"
            element={
              <>
                <SkipLink />
                <SolicitarRecuperacion />
              </>
            }
          />
          <Route
            path="/restablecer"
            element={
              <>
                <SkipLink />
                <Restablecer />
              </>
            }
          />
          <Route
            path="/restablecer/:token"
            element={
              <>
                <SkipLink />
                <Restablecer />
              </>
            }
          />
          <Route path="/app" element={<PrivateRoute />} />
          {/* Aliases históricos: conservan bookmarks, no duplican componente */}
          <Route path="/privado" element={<Navigate to="/app" replace />} />
          <Route
            path="/mis-oportunidades"
            element={<Navigate to="/app" replace />}
          />
          <Route path="/" element={<PublicDashboardRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
export default App;
