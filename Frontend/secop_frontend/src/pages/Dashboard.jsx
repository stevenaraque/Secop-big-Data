import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API = "http://127.0.0.1:8000/api";

async function fetchResumen(depto, token) {
  const url = depto
    ? `${API}/optimized/resumen/?depto=${depto}`
    : `${API}/optimized/resumen/`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Error resumen");
  return r.json();
}

async function fetchTop(depto, token) {
  const url = depto
    ? `${API}/optimized/top-contratistas/?limit=5&depto=${depto}`
    : `${API}/optimized/top-contratistas/?limit=5`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Error top");
  return r.json();
}

export default function Dashboard({ token }) {
  const [depto, setDepto] = useState("Boyacá");

  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ["resumen", depto],
    queryFn: () => fetchResumen(depto, token),
    enabled: !!token,
  });

  const { data: top } = useQuery({
    queryKey: ["top", depto],
    queryFn: () => fetchTop(depto, token),
    enabled: !!token,
  });

  if (cargandoResumen) return <p>Cargando KPIs...</p>;

  return (
    <section>
      <h1>SECOP Insight — Dashboard RF-12</h1>
      <select value={depto} onChange={(e) => setDepto(e.target.value)}>
        <option value="">Todos</option>
        <option value="Boyacá">Boyacá</option>
        <option value="Antioquia">Antioquia</option>
        <option value="Distrito Capital de Bogotá">Bogotá</option>
      </select>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        <div>Total: {resumen?.total}</div>
        <div>Suma: {Number(resumen?.suma_valor).toLocaleString("es-CO")}</div>
        <div>
          Promedio: {Number(resumen?.promedio_valor).toLocaleString("es-CO")}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={top?.top || []}>
          <XAxis dataKey="contratista_nombre" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey="suma_valor" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
