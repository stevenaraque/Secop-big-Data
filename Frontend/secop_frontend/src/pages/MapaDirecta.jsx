import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "./MapaRF15.css"

const API = "http://127.0.0.1:8000/api"
async function fetchMapa(token) {
  const r = await fetch(`${API}/optimized/mapa-directa/`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error("Error mapa")
  return r.json()
}

/* ---------- escala continua 0 -> rojo oscuro (igual que el demo) ---------- */
const STOPS = [[0,[243,236,221]],[.25,[238,210,182]],[.5,[226,154,118]],[.7,[204,91,64]],[.85,[165,42,32]],[1,[101,13,16]]]
function colorFor(t) {
  t = Math.max(0, Math.min(1, t))
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [p0, c0] = STOPS[i-1], [p1, c1] = STOPS[i], u = (t - p0) / (p1 - p0)
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * u))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
  return "rgb(101,13,16)"
}
const GRAD = `linear-gradient(90deg, ${STOPS.map(s=>`rgb(${s[1].join(",")}) ${Math.round(s[0]*100)}%`).join(",")})`
const nf1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat("es-CO")
const fmtPct = p => nf1.format(p) + " %"
const fmtCOP = v => "$" + nf0.format(Math.round(Number(v) || 0))
const norm = s => (s||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z ]/g," ").replace(/\s+/g," ").trim()

/* ---------- 33 territorios en el orden exacto de GEO ---------- */
const BASE = [
 ["Amazonas","Amazonía"],["Antioquia","Andina"],["Arauca","Orinoquía"],
 ["Atlántico","Caribe"],["Bogotá D.C.","Bogotá D.C."],["Bolívar","Caribe"],
 ["Boyacá","Andina"],["Caldas","Andina"],["Caquetá","Amazonía"],
 ["Casanare","Orinoquía"],["Cauca","Pacífica"],["Cesar","Caribe"],
 ["Chocó","Pacífica"],["Córdoba","Caribe"],["Cundinamarca","Andina"],
 ["Guainía","Orinoquía"],["Guaviare","Orinoquía"],["Huila","Andina"],
 ["La Guajira","Caribe"],["Magdalena","Caribe"],["Meta","Orinoquía"],
 ["Nariño","Pacífica"],["Norte de Santander","Andina"],["Putumayo","Amazonía"],
 ["Quindío","Andina"],["Risaralda","Andina"],["San Andrés y Providencia","Caribe"],
 ["Santander","Andina"],["Sucre","Caribe"],["Tolima","Andina"],
 ["Valle del Cauca","Andina"],["Vaupés","Amazonía"],["Vichada","Orinoquía"],
]

/* ---------- geografía simplificada embebida (baja resolución) ---------- */
const GEO = [
[[[-70.05,-4.2],[-69.42,-4.3],[-69.4,-2.6],[-69.9,-2.35],[-69.3,-1.45],[-68.35,-0.2],[-67.9,0.3],[-67.6,0.8],[-67.35,1.2],[-67.0,2.05],[-67.6,1.85],[-68.75,1.95],[-69.2,1.1],[-68.9,0.35],[-69.9,0.6],[-70.5,0.55],[-71.0,0.45],[-71.6,0.7],[-72.0,0.75],[-72.7,0.9],[-73.3,0.8],[-74.1,0.55],[-74.55,0.25],[-74.7,0.15],[-75.3,-0.1],[-76.0,-0.1],[-76.5,0.1],[-76.9,0.35],[-77.35,0.8],[-77.2,0.3],[-76.6,-0.35],[-76.0,-1.0],[-75.4,-1.8],[-74.8,-2.6],[-74.0,-3.4],[-72.6,-4.0]]],
[[[-77.12,8.78],[-76.98,8.45],[-76.85,8.1],[-76.75,7.6],[-76.6,7.2],[-76.3,6.7],[-76.1,6.1],[-75.9,5.78],[-75.45,5.85],[-75.2,5.88],[-74.85,5.98],[-74.6,5.92],[-74.35,5.72],[-74.5,6.62],[-74.45,7.05],[-74.42,7.5],[-74.2,7.95],[-74.75,8.15],[-75.1,7.95],[-75.3,8.05],[-75.38,8.4],[-75.65,8.0],[-75.95,8.25],[-76.35,8.05],[-76.55,8.35],[-76.5,8.55],[-76.3,8.6],[-76.55,8.68],[-76.88,8.6]]],
[[[-72.72,7.08],[-72.6,6.85],[-72.7,6.5],[-72.55,6.15],[-72.1,6.1],[-71.4,5.85],[-70.9,5.5],[-70.6,6.0],[-69.98,6.4],[-69.98,7.05],[-70.9,7.32],[-71.8,7.45],[-72.25,7.42],[-72.5,7.3]]],
[[[-74.85,11.02],[-74.7,10.7],[-74.85,10.55],[-75.0,10.62],[-75.15,10.78],[-75.0,10.9]]],
[[[-74.22,4.48],[-73.99,4.48],[-73.99,4.83],[-74.22,4.83]]],
[[[-75.62,9.72],[-75.58,10.05],[-75.5,10.42],[-75.15,10.78],[-74.85,11.02],[-74.7,10.7],[-74.75,10.3],[-74.85,10.0],[-75.05,9.75],[-74.95,9.45],[-74.75,9.5],[-74.6,9.35],[-74.42,9.0],[-74.5,8.6],[-74.45,8.3],[-74.42,7.92],[-74.15,7.52],[-73.95,7.1],[-73.85,6.7],[-73.9,6.45],[-74.15,6.7],[-74.42,7.0],[-74.42,7.5],[-74.2,7.95],[-74.75,8.15],[-75.1,7.95],[-75.3,8.05],[-75.38,8.4],[-75.44,8.9],[-75.24,9.14],[-75.38,9.45],[-75.3,9.7]]],
[[[-74.5,6.62],[-73.32,6.98],[-73.0,7.15],[-72.72,7.08],[-72.6,6.85],[-72.7,6.2],[-72.8,5.6],[-72.6,5.05],[-72.55,4.35],[-72.85,4.55],[-73.1,5.05],[-73.55,5.3],[-73.4,5.55],[-73.6,6.0],[-73.95,5.8],[-74.05,5.5],[-74.15,5.25],[-74.25,5.15],[-74.35,5.7],[-74.6,5.92]]],
[[[-74.6,5.92],[-74.35,5.72],[-74.4,5.95],[-74.85,5.98],[-75.2,5.88],[-75.45,5.85],[-75.55,5.6],[-75.4,5.5],[-75.28,5.3],[-75.1,5.15],[-74.85,5.55]]],
[[[-74.55,0.25],[-74.4,0.9],[-74.9,1.2],[-75.35,1.55],[-75.6,1.9],[-75.9,2.2],[-76.0,2.35],[-75.6,2.5],[-75.0,2.6],[-74.7,2.5],[-74.2,2.4],[-73.9,2.35],[-73.3,1.7],[-72.85,1.35],[-72.3,1.25],[-71.75,1.2],[-71.6,0.7],[-72.0,0.75],[-72.7,0.9],[-73.3,0.8],[-74.1,0.55]]],
[[[-72.6,6.85],[-72.7,6.2],[-72.8,5.6],[-72.6,5.05],[-72.55,4.35],[-72.35,4.2],[-71.6,4.25],[-71.05,4.5],[-70.95,5.0],[-70.9,5.5],[-71.4,5.85],[-72.1,6.1],[-72.55,6.15],[-72.7,6.5]]],
[[[-77.55,3.35],[-77.2,3.1],[-76.9,2.9],[-76.6,2.85],[-76.2,2.9],[-76.05,2.85],[-76.2,2.6],[-76.45,2.3],[-76.5,1.95],[-76.3,1.95],[-76.45,1.7],[-76.7,1.5],[-76.95,1.35],[-77.15,1.25],[-77.35,1.6],[-77.55,1.9],[-77.7,2.15],[-77.72,2.45],[-77.8,2.65],[-78.0,2.8],[-77.85,2.9],[-77.65,3.1]]],
[[[-73.2,10.6],[-72.55,10.42],[-72.5,9.95],[-72.72,9.35],[-72.55,8.75],[-72.72,8.1],[-73.1,7.82],[-73.5,7.9],[-73.55,7.68],[-73.85,7.62],[-74.15,7.52],[-74.42,7.92],[-74.45,8.3],[-74.5,8.6],[-74.42,9.0],[-74.48,9.35],[-74.35,9.9],[-74.2,10.35],[-74.38,10.72],[-73.75,10.88],[-73.3,10.72]]],
[[[-77.12,8.78],[-76.98,8.45],[-76.85,8.1],[-76.75,7.6],[-76.6,7.2],[-76.3,6.7],[-76.1,6.1],[-75.9,5.78],[-75.95,5.3],[-76.05,4.7],[-76.4,4.45],[-76.7,4.05],[-76.95,3.75],[-77.25,3.75],[-77.4,4.0],[-77.4,4.35],[-77.35,5.0],[-77.3,5.7],[-77.55,5.9],[-77.9,6.2],[-77.75,6.9],[-77.3,7.2],[-77.2,7.9],[-77.35,8.4]]],
[[[-76.3,8.6],[-76.05,9.0],[-75.9,9.35],[-75.65,9.68],[-75.5,9.3],[-75.72,9.08],[-75.82,8.85],[-75.62,8.62],[-75.38,8.4],[-75.3,8.05],[-75.65,8.0],[-75.95,8.25],[-76.35,8.05],[-76.55,8.35],[-76.5,8.55]]],
[[[-73.55,5.3],[-73.4,5.55],[-73.6,6.0],[-73.95,5.8],[-74.05,5.5],[-74.15,5.25],[-74.25,5.15],[-74.55,4.85],[-74.7,4.5],[-74.6,4.15],[-74.55,3.9],[-74.35,3.75],[-74.15,3.85],[-73.95,4.05],[-73.7,4.35],[-73.45,4.55],[-73.4,4.9]]],
[[[-69.9,2.7],[-69.4,3.3],[-68.3,3.95],[-67.6,4.0],[-67.15,3.6],[-66.95,3.0],[-67.0,2.05],[-67.6,1.85],[-68.75,1.95],[-69.5,1.65],[-69.9,1.55]]],
[[[-73.9,2.35],[-73.3,3.6],[-72.85,3.75],[-72.0,3.8],[-71.3,3.75],[-70.9,3.9],[-70.3,3.1],[-69.9,2.7],[-69.9,1.55],[-70.1,1.55],[-70.95,1.6],[-71.75,1.75],[-72.3,1.25],[-72.85,1.35],[-73.3,1.7]]],
[[[-74.55,2.95],[-74.7,3.3],[-74.85,3.7],[-75.1,3.85],[-75.4,3.7],[-75.7,3.8],[-75.8,3.6],[-76.0,3.0],[-76.05,2.85],[-76.2,2.6],[-76.45,2.3],[-76.5,1.95],[-76.3,1.95],[-75.9,2.2],[-75.6,2.5],[-75.0,2.6],[-74.7,2.5]]],
[[[-73.2,10.6],[-73.0,10.95],[-73.25,11.1],[-73.2,11.12],[-72.9,11.52],[-72.65,12.1],[-72.9,12.25],[-72.15,12.38],[-71.65,12.43],[-71.32,11.8],[-71.32,10.95],[-71.9,10.55],[-72.55,10.42]]],
[[[-74.85,11.02],[-74.3,11.12],[-74.13,11.32],[-73.75,11.18],[-73.25,11.1],[-73.3,10.72],[-73.75,10.88],[-74.38,10.72],[-74.2,10.35],[-74.35,9.9],[-74.48,9.35],[-74.42,9.0],[-74.5,8.6],[-74.45,8.3],[-74.6,9.35],[-74.75,9.5],[-74.95,9.45],[-75.05,9.75],[-74.85,10.0],[-74.75,10.3],[-74.7,10.7]]],
[[[-73.55,5.3],[-74.0,4.9],[-74.3,4.6],[-74.55,4.15],[-74.6,3.9],[-74.55,3.4],[-74.55,2.95],[-74.7,2.5],[-74.2,2.4],[-73.9,2.35],[-73.3,3.6],[-72.85,3.75],[-72.0,3.8],[-71.3,3.75],[-70.9,3.9],[-70.95,4.5],[-71.6,4.25],[-72.55,4.35],[-72.85,4.55]]],
[[[-78.0,2.8],[-77.8,2.65],[-77.72,2.45],[-77.7,2.15],[-77.55,1.9],[-77.35,1.6],[-77.15,1.25],[-76.95,1.1],[-76.75,0.95],[-77.05,0.8],[-77.35,0.8],[-77.6,0.72],[-78.1,0.62],[-78.55,0.72],[-78.85,0.62],[-78.95,1.05],[-78.98,1.55],[-78.8,1.85],[-78.45,2.2],[-78.15,2.55]]],
[[[-73.42,7.35],[-73.32,6.98],[-73.0,7.15],[-72.72,7.08],[-72.62,7.35],[-72.45,7.5],[-72.42,7.95],[-72.55,8.35],[-72.5,8.8],[-72.62,9.15],[-72.85,8.75],[-72.9,8.4],[-72.72,8.1],[-73.1,7.82],[-73.4,7.85]]],
[[[-76.3,1.95],[-76.45,1.7],[-76.7,1.5],[-76.95,1.35],[-77.15,1.25],[-76.95,1.1],[-76.75,0.95],[-77.05,0.8],[-77.35,0.8],[-76.9,0.35],[-76.5,0.1],[-76.0,-0.1],[-75.3,-0.1],[-74.7,0.15],[-74.55,0.25],[-74.4,0.9],[-74.9,1.2],[-75.35,1.55],[-75.6,1.9],[-75.9,2.2]]],
[[[-75.68,5.05],[-75.5,5.2],[-75.32,5.05],[-75.28,4.75],[-75.5,4.45],[-75.85,4.4],[-75.95,4.6],[-75.6,4.75]]],
[[[-75.9,5.78],[-75.45,5.85],[-75.55,5.6],[-75.42,5.48],[-75.5,5.2],[-75.68,5.05],[-75.6,4.75],[-76.05,4.7],[-75.95,5.3]]],
[[[-81.78,12.44],[-81.75,12.49],[-81.72,12.55],[-81.68,12.58],[-81.64,12.56],[-81.66,12.5],[-81.7,12.43],[-81.74,12.41]],[[-81.42,13.3],[-81.39,13.33],[-81.35,13.37],[-81.31,13.35],[-81.32,13.31],[-81.36,13.28],[-81.4,13.27]]],
[[[-74.42,7.5],[-73.95,7.1],[-73.85,6.7],[-73.9,6.45],[-73.6,6.1],[-73.55,5.42],[-73.45,5.9],[-73.5,6.35],[-73.32,6.98],[-73.42,7.35],[-73.5,7.55],[-73.4,7.85],[-73.62,7.75],[-73.85,7.62],[-74.15,7.52]]],
[[[-75.62,9.72],[-75.45,9.92],[-75.3,9.7],[-75.38,9.45],[-75.24,9.14],[-75.44,8.9],[-75.58,8.62],[-75.36,8.36],[-75.62,8.7],[-75.78,9.0],[-75.68,9.32],[-75.85,9.52],[-75.75,9.65]]],
[[[-74.55,3.9],[-74.6,4.15],[-74.7,4.5],[-74.55,4.85],[-74.25,5.0],[-74.3,5.15],[-75.1,5.15],[-75.28,5.3],[-75.4,5.5],[-75.5,5.2],[-75.68,5.05],[-75.6,4.75],[-75.95,4.6],[-76.05,4.5],[-76.1,4.3],[-75.9,4.05],[-75.7,3.8],[-75.4,3.7],[-75.1,3.85],[-74.85,3.7]]],
[[[-77.55,3.35],[-77.4,3.7],[-77.25,3.75],[-76.95,3.75],[-76.7,4.05],[-76.4,4.45],[-76.05,4.7],[-75.95,4.6],[-76.1,4.3],[-75.9,4.05],[-75.7,3.8],[-75.8,3.6],[-76.2,2.9],[-76.6,2.85],[-76.9,2.9],[-77.2,3.1]]],
[[[-69.9,0.6],[-70.5,0.55],[-71.0,0.45],[-71.6,0.7],[-71.75,1.2],[-72.3,1.25],[-71.75,1.75],[-70.95,1.6],[-70.1,1.55],[-69.9,1.55],[-69.5,1.65],[-69.2,1.1],[-68.9,0.35]]],
[[[-67.5,6.19],[-67.3,5.35],[-67.05,4.45],[-67.15,3.95],[-68.0,3.95],[-69.4,3.35],[-69.9,2.7],[-70.3,3.1],[-70.6,3.9],[-70.95,4.5],[-71.05,5.0],[-70.9,5.5],[-70.6,6.0],[-69.98,6.4],[-68.7,6.28],[-67.9,6.35]]],
]
const SILUETA = [[-77.38,8.62],[-77.12,8.78],[-76.88,8.6],[-76.55,8.68],[-76.3,8.62],[-75.87,9.42],[-75.62,9.72],[-75.58,10.05],[-75.5,10.42],[-75.15,10.78],[-74.85,11.02],[-74.3,11.12],[-74.13,11.32],[-73.75,11.18],[-73.25,11.1],[-72.9,11.52],[-72.65,12.1],[-72.9,12.25],[-72.15,12.38],[-71.65,12.43],[-71.32,11.8],[-71.32,10.95],[-72.2,10.1],[-72.55,9.5],[-72.8,9.0],[-72.55,8.5],[-72.35,8.0],[-72.25,7.42],[-71.8,7.45],[-70.9,7.32],[-69.98,7.05],[-69.98,6.4],[-68.7,6.28],[-67.9,6.35],[-67.5,6.19],[-67.3,5.35],[-67.05,4.45],[-67.15,3.95],[-66.95,3.0],[-67.0,2.05],[-67.35,1.2],[-67.6,0.8],[-67.9,0.3],[-68.35,-0.2],[-69.3,-1.45],[-69.9,-2.35],[-69.4,-2.62],[-69.42,-4.3],[-71.0,-4.1],[-72.6,-4.0],[-74.0,-3.4],[-74.8,-2.6],[-75.4,-1.8],[-76.0,-1.0],[-76.6,-0.35],[-77.2,0.3],[-77.35,0.8],[-77.9,0.65],[-78.5,0.7],[-78.85,0.62],[-78.95,1.05],[-78.98,1.55],[-78.8,1.85],[-78.45,2.2],[-78.15,2.55],[-78.0,2.8],[-77.85,2.9],[-77.65,3.1],[-77.55,3.35],[-77.4,3.7],[-77.4,4.35],[-77.7,5.0],[-77.9,5.9],[-77.75,6.9],[-77.3,7.2],[-77.2,7.9],[-77.35,8.4]]

/* ---------- codec compacto 0.01° + delta + base64 (CA-3) ---------- */
const QQ = 100
const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$"
const OFF = 131072
const w3 = n => { const m = n + OFF; return ALPHA[(m>>12)&63] + ALPHA[(m>>6)&63] + ALPHA[m&63] }
const r3 = (s,i) => (ALPHA.indexOf(s[i])*4096 + ALPHA.indexOf(s[i+1])*64 + ALPHA.indexOf(s[i+2])) - OFF
function toToken(depts) {
  let out = ""
  for (const rings of depts) {
    out += w3(rings.length)
    for (const ring of rings) {
      out += w3(ring.length)
      let px = 0, py = 0
      for (const p of ring) {
        const x = Math.round(p[0]*QQ), y = Math.round(p[1]*QQ)
        out += w3(x-px) + w3(y-py); px = x; py = y
      }
    }
  }
  return out
}
function fromToken(tok) {
  const depts = []; let i = 0
  while (i < tok.length) {
    const nR = r3(tok, i); i += 3
    const rings = []
    for (let r = 0; r < nR; r++) {
      const n = r3(tok, i); i += 3
      const ring = []; let x = 0, y = 0
      for (let k = 0; k < n; k++) { x += r3(tok,i); y += r3(tok,i+3); i += 6; ring.push([x/QQ, y/QQ]) }
      rings.push(ring)
    }
    depts.push(rings)
  }
  return depts
}

export default function MapaDirecta({ token, onSelectDepto }) {
  const wrapRef = useRef(null)
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef(null)
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(null)
  const [payload, setPayload] = useState(null)
  const [ca, setCa] = useState([false, false, false, false])

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mapa"], queryFn: () => fetchMapa(token),
    enabled: !!token, staleTime: 1000 * 60 * 5,
  })

  const reales = useMemo(() => {
    const m = {}
    for (const d of (data?.mapa || [])) m[norm(d.departamento)] = d
    // alias Bogotá D.C. <-> Distrito Capital
    return m
  }, [data])

  const datos33 = useMemo(() => BASE.map(([n, r], i) => {
    const hit = reales[norm(n)] || (norm(n).includes("BOGOTA") ? reales[norm("Distrito Capital de Bogotá")] || reales[norm("Bogota D.C.")] : null)
    if (hit) return { id: i, n, r, pct: Number(hit.porcentaje_directa), total: hit.total, directas: hit.directas, monto: Number(hit.suma_total || 0), montoD: Number(hit.suma_directa || 0), real: true }
    return { id: i, n, r, pct: null, total: 0, directas: 0, monto: 0, montoD: 0, real: false }
  }), [reales])

  const marcar = (i, nota) => setCa(prev => {
    if (prev[i]) return prev
    const nx = prev.slice(); nx[i] = nota || true
    return nx
  })

  useEffect(() => {
    if (!wrapRef.current || mapRef.current || typeof L === "undefined") return
    const map = L.map(mapElRef.current, { zoomControl: false, attributionControl: false, minZoom: 4, maxZoom: 12 }).setView([4.4, -73.2], 5)
    L.control.zoom({ position: "topleft" }).addTo(map)
    map.fitBounds([[-4.6, -82.6], [13.9, -66.7]])
    map.on("click", () => setSel(null))
    mapRef.current = map
    marcar(0, "Leaflet 1.9.4 · coroplético con zoom/pan")
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !datos33.length) return
    // CA-3: round-trip compacto y medición
    const t0 = performance.now()
    const tokenC = toToken(GEO)
    const back = fromToken(tokenC)
    const ok = back.length === GEO.length && toToken(back) === tokenC
    const tokB = new Blob([tokenC]).size
    const eqB = new Blob([JSON.stringify(GEO)]).size
    const red = Math.round((1 - tokB / eqB) * 100)
    if (ok) {
      setPayload({ tokB, eqB, red, ms: ((performance.now() - t0)).toFixed(0) })
      marcar(2, `compacto ${tokB}B vs GeoJSON ${eqB}B (−${red}%)`)
    }
    if (layersRef.current) { map.removeLayer(layersRef.current); layersRef.current = null }
    L.polygon(SILUETA.map(p => [p[1], p[0]]), { color: "#c3b691", weight: 1, fillColor: "#e7dcba", fillOpacity: 1, interactive: false }).addTo(map)
    const feats = back.map((rings, i) => ({
      type: "Feature",
      properties: { __id: i, __d: datos33[i], name: BASE[i][0] },
      geometry: rings.length > 1
        ? { type: "MultiPolygon", coordinates: rings.map(rg => [rg.map(p => [p[0], p[1]])]) }
        : { type: "Polygon", coordinates: [rings[0]] },
    }))
    const layers = L.geoJSON({ type: "FeatureCollection", features: feats }, {
      style: f => {
        const d = f.properties.__d
        return { color: "#fdfaf1", weight: 1.1, fillColor: d && d.real ? colorFor(d.pct / 100) : "#d9cfba", fillOpacity: 1 }
      },
      onEachFeature: (f, layer) => {
        const d = f.properties.__d
        layer.bindTooltip("…", { sticky: true, direction: "top", className: "rf-tip", opacity: 1 })
        layer.on("mouseover", () => {
          layer.setStyle({ color: "#221a12", weight: 2 }); layer.bringToFront()
          layer.setTooltipContent(d && d.real
            ? `<div class="tt-name">${d.n}</div><div class="tt-row"><span>Monto</span><b>${fmtCOP(d.monto)} COP</b></div><div class="tt-row"><span>Directa</span><b>${fmtPct(d.pct)}</b></div><div class="tt-bar"><span style="width:${Math.min(100,d.pct)}%;background:${colorFor(d.pct/100)}"></span></div>`
            : `<div class="tt-name">${d.n}</div><div class="tt-sub">sin datos en la muestra actual</div>`)
          marcar(3, "tooltip con monto y % activo")
        })
        layer.on("mouseout", () => { layers.resetStyle(layer) })
        layer.on("click", e => { L.DomEvent.stopPropagation(e); setSel(f.properties.__id); if (onSelectDepto) onSelectDepto(BASE[f.properties.__id][0]) })
      },
    }).addTo(map)
    layersRef.current = layers
    marcar(1, "escala continua 0–100% aplicada")
  }, [datos33])

  useEffect(() => {
    const layers = layersRef.current
    if (!layers) return
    layers.eachLayer(l => {
      const id = l.feature.properties.__id
      if (id === sel) l.setStyle({ color: "#221a12", weight: 2.4 })
      else layers.resetStyle(l)
    })
  }, [sel])

  const order = datos33.slice().sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
  const filtrados = q ? order.filter(d => norm(d.n).includes(norm(q))) : order
  const selD = sel != null ? datos33[sel] : null
  const realesCount = datos33.filter(d => d.real).length
  const nVerif = ca.filter(Boolean).length

  if (!token) return null
  if (isLoading) return <div className="rf15"><div style={{ padding: 18 }}>Cargando geografía y datos…</div></div>
  if (isError) return <div className="rf15"><div style={{ padding: 18 }}>No se pudo cargar el mapa. Revisa tu access.</div></div>

  return (
    <div className="rf15" ref={wrapRef}>
      <div className="topbar"><span className="tb-id">RF-15 · MAPA COROPLÉTICO</span><span className="tb-sep">/</span><span className="chip">DATOS REALES API</span><span className="tb-right"><span className="chip">{realesCount}/33 CON DATOS</span><span className="chip state"><span className="dot" />{nVerif}/4 CA</span></span></div>
      <header>
        <div className="rf-box"><div className="rf-num">RF-15</div><div className="rf-sub">FUNCIONAL · SPRINT 3</div></div>
        <div className="head-mid">
          <div className="kicker">ROJO OSCURO = ALTA CONTRATACIÓN DIRECTA</div>
          <h1>Contratación directa por territorio</h1>
          <p className="hist"><b>Historia —</b> “Como usuario, quiero ver un mapa que pinte los territorios según el % de contratación directa.” Clic en un territorio filtra el dashboard.</p>
        </div>
        <dl className="head-meta"><dt>FUENTE</dt><dd>/api/optimized/mapa-directa/</dd><dt>PAYLOAD</dt><dd>{payload ? `${payload.tokB}B (−${payload.red}%)` : "…"}</dd><dt>DEPENDE</dt><dd>RF-12</dd></dl>
      </header>
      <main>
        <section className="map-zone">
          <div className="map-head"><span id="foco">{selD ? `FOCO · ${selD.n.toUpperCase()}` : "VISTA NACIONAL · COLOMBIA"}</span><button className="btn" onClick={() => setSel(null)}>VER TODO</button></div>
          <div className="map-wrap"><div id="rf15-map" ref={mapElRef} />
            <div className="legend"><div className="lg-t">ESCALA CONTINUA · % DIRECTA</div><div className="lg-bar" style={{ background: GRAD }} /><div className="lg-ticks"><span>0%</span><span>50%</span><span>100%</span></div><div className="lg-cap"><b>Rojo oscuro</b>: alto % directa frente a licitación.</div></div>
          </div>
        </section>
        <aside>
          <div className="search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar territorio…" /></div>
          <div className="ficha">
            {selD ? (<><h2>{selD.n}</h2><div className="big"><span className="big-num">{selD.real ? fmtPct(selD.pct) : "—"}</span></div><div className="mgrid"><div className="mcell"><div className="m-l">CONTRATOS</div><div className="m-v">{selD.total}</div></div><div className="mcell"><div className="m-l">MONTO</div><div className="m-v">{fmtCOP(selD.monto)}</div></div></div><div className={`alerta ${selD.pct >= 85 ? "a-high" : selD.pct >= 65 ? "a-mid" : "a-low"}`}>{selD.real ? (selD.pct >= 85 ? "ALERTA ALTA · posible contratación a dedo" : "Patrón bajo vigilancia") : "Sin datos en la muestra"}</div></>) : (<><h2>Colombia</h2><p className="hist">Pasa el cursor para tooltip con monto y %. Clic para filtrar el dashboard.</p></>)}
          </div>
          <div className="rk-head">RANKING · % DIRECTA<em>{realesCount} CON DATOS</em></div>
          <div className="rk-list">{filtrados.map((d, i) => (<button key={d.n} onClick={() => { setSel(d.id); if (onSelectDepto) onSelectDepto(d.n) }} className={`rk-item ${sel === d.id ? "sel" : ""}`}><span className="rk-n">{String(i + 1).padStart(2, "0")}</span><span><span className="rk-name">{d.n}</span></span><span className="rk-pct">{d.real ? fmtPct(d.pct) : "—"}</span></button>))}</div>
        </aside>
      </main>
    </div>
  )
}
