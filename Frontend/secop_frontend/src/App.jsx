import Dashboard from "./pages/Dashboard.jsx";
import SolicitarRecuperacion from "./pages/SolicitarRecuperacion.jsx";
import Restablecer from "./pages/Restablecer.jsx";
import "./App.css";

function App() {
  const path = window.location.pathname;
  // RNF-11: skip link para teclado — Qué: Tab salta a contenido. Por qué: WCAG 2.4.1
  const skip = (
    <a href="#contenido" className="skip-link">
      Saltar al contenido
    </a>
  );
  if (path.includes("restablecer"))
    return (
      <>
        {skip}
        <Restablecer />
      </>
    );
  if (path.includes("recuperar"))
    return (
      <>
        {skip}
        <SolicitarRecuperacion />
      </>
    );
  return (
    <>
      {skip}
      <Dashboard token={localStorage.getItem("access")} />
    </>
  );
}
export default App;
