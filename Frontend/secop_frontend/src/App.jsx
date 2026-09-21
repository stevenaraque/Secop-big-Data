import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Lazy por ruta: recharts/leaflet/graph no entran al chunk inicial.
// DashboardModern ya hace lazy interno de Mapa/Grafo; aquí partimos Login/privado.
const DashboardModern = lazy(() => import("./pages/DashboardModern.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Registro = lazy(() => import("./pages/Registro.jsx"));
const SolicitarRecuperacion = lazy(() => import("./pages/SolicitarRecuperacion.jsx"));
const Restablecer = lazy(() => import("./pages/Restablecer.jsx"));
const PrivateDashboard = lazy(() => import("./pages/PrivateDashboard.jsx"));

// RNF-11: skip link para teclado — Qué: Tab salta a contenido. Por qué: WCAG 2.4.1
function SkipLink() {
  return (
    <a href="#contenido" className="skip-link">
      Saltar al contenido
    </a>
  );
}

function PublicDashboardRoute() {
  // Nota: el backend exige IsAuthenticated incluso para el observatorio "público",
  // por eso / pide token y manda a /login. Hacerlo público real exige backend anónimo.
  const token = localStorage.getItem("access");
  if (!token) return <Navigate to="/login" replace />;
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
    if ("requestIdleCallback" in window) requestIdleCallback(prefetch, { timeout: 2500 });
    else setTimeout(prefetch, 1800);
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Cargando…</p>}>
        <Routes>
          <Route path="/login" element={<><SkipLink /><Login /></>} />
          <Route path="/registro" element={<><SkipLink /><Registro /></>} />
          <Route path="/recuperar" element={<><SkipLink /><SolicitarRecuperacion /></>} />
          <Route path="/restablecer" element={<><SkipLink /><Restablecer /></>} />
          <Route path="/restablecer/:token" element={<><SkipLink /><Restablecer /></>} />
          <Route path="/app" element={<PrivateRoute />} />
          {/* Aliases históricos: conservan bookmarks, no duplican componente */}
          <Route path="/privado" element={<Navigate to="/app" replace />} />
          <Route path="/mis-oportunidades" element={<Navigate to="/app" replace />} />
          <Route path="/" element={<PublicDashboardRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
export default App;
