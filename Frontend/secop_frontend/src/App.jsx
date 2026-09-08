import Dashboard from "./pages/Dashboard.jsx";
import "./App.css";

function App() {
  return <Dashboard token={localStorage.getItem("access")} />;
}
export default App;
