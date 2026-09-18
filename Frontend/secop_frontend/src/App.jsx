import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardModern from "./pages/DashboardModern.jsx";
import Login from "./pages/Login.jsx";
import SolicitarRecuperacion from "./pages/SolicitarRecuperacion.jsx";
import Restablecer from "./pages/Restablecer.jsx";
import PrivateDashboard from "./pages/PrivateDashboard.jsx";
import "./App.css";

// RNF-11: skip link para teclado — Qué: Tab salta a contenido. Por qué: WCAG 2.4.1
function SkipLink() {
  return (
    <a href="#contenido" className="skip-link">
      Saltar al contenido
    </a>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicDashboardRoute() {
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<><SkipLink /><Login /></>} />
        <Route path="/recuperar" element={<><SkipLink /><SolicitarRecuperacion /></>} />
        <Route path="/restablecer" element={<><SkipLink /><Restablecer /></>} />
        <Route path="/restablecer/:token" element={<><SkipLink /><Restablecer /></>} />
        <Route path="/app" element={<PrivateRoute />} />
        <Route path="/privado" element={<PrivateRoute />} />
        <Route path="/mis-oportunidades" element={<PrivateRoute />} />
        <Route path="/" element={<PublicDashboardRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
