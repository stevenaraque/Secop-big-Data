import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Lazy por ruta: recharts/leaflet/graph no entran al chunk inicial.
// DashboardModern ya hace lazy interno de Mapa/Grafo; aquí partimos Login/privado.
// Mínimo 100ms por carga: el fallback parpadea si el chunk llega antes;
// la espera corre en paralelo con la descarga, no la alarga en la práctica.
const minimo = (fn) =>
  lazy(() =>
    Promise.all([fn(), new Promise((r) => setTimeout(r, 800))]).then(
      ([mod]) => mod,
    ),
  );
const DashboardModern = minimo(() => import("./pages/DashboardModern.jsx"));
const Login = minimo(() => import("./pages/Login.jsx"));
const Registro = minimo(() => import("./pages/Registro.jsx"));
const SolicitarRecuperacion = minimo(
  () => import("./pages/SolicitarRecuperacion.jsx"),
);
const Restablecer = minimo(() => import("./pages/Restablecer.jsx"));
const PrivateDashboard = minimo(() => import("./pages/PrivateDashboard.jsx"));
import PantallaCarga from "./components/PantallaCarga.jsx";

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
  const token = localStorage.getItem("access");
  if (!token) return <Navigate to="/login" replace />;
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
      <Suspense fallback={<PantallaCarga />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
export default App;
