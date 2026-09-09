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

/* escala continua 0 -> rojo oscuro */
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

export default function MapaDirecta({ token, onSelectDepto }) {
  const wrapRef = useRef(null)
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef(null)
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(null)
  const [geo, setGeo] = useState(null)
  const [geoErr, setGeoErr] = useState(null)
  const [ca, setCa] = useState([false, false, false, false])

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mapa"], queryFn: () => fetchMapa(token),
    enabled: !!token, staleTime: 1000 * 60 * 5,
  })

  /* GeoJSON real 33 territorios desde /public */
  useEffect(() => {
    let vivo = true
    fetch("/colombia.geojson").then(r => {
      if (!r.ok) throw new Error("GeoJSON " + r.status)
      return r.json()
    }).then(g => { if (vivo) setGeo(g) }).catch(e => { if (vivo) setGeoErr(String(e.message || e)) })
    return () => { vivo = false }
  }, [])

  const reales = useMemo(() => {
    const m = {}
    for (const d of (data?.mapa || [])) m[norm(d.departamento)] = d
    const bdc = m[norm("Distrito Capital de Bogotá")]
    if (bdc) m[norm("Bogotá D.C.")] = bdc
    return m
  }, [data])

  const filas = useMemo(() => {
    if (!geo) return []
    return geo.features.map((f, i) => {
      const nombre = f.properties?.name || `T-${i}`
      const hit = reales[norm(nombre)]
      return hit
        ? { id: i, n: nombre, pct: Number(hit.porcentaje_directa), total: hit.total, directas: hit.directas, monto: Number(hit.suma_total || 0), montoD: Number(hit.suma_directa || 0), real: true }
        : { id: i, n: nombre, pct: null, total: 0, directas: 0, monto: 0, montoD: 0, real: false }
    }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
  }, [geo, reales])

  const porId = useMemo(() => {
    const m = {}
    if (!geo) return m
    geo.features.forEach((f, i) => { m[i] = filas.find(x => x.n === (f.properties?.name || "")) || { id: i, n: f.properties?.name, pct: null, real: false, total: 0, directas: 0, monto: 0 } })
    return m
  }, [geo, filas])

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
    marcar(0, "Leaflet 1.9.4 · coroplético real 33 territorios")
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !geo) return
    if (layersRef.current) { map.removeLayer(layersRef.current); layersRef.current = null }
    const layers = L.geoJSON(geo, {
      style: f => {
        const idx = geo.features.indexOf(f)
        const d = porId[idx]
        return { color: "#fdfaf1", weight: 1.1, fillColor: d && d.real ? colorFor(d.pct / 100) : "#d9cfba", fillOpacity: 1 }
      },
      onEachFeature: (f, layer) => {
        const idx = geo.features.indexOf(f)
        const d = porId[idx]
        layer.bindTooltip("…", { sticky: true, direction: "top", className: "rf-tip", opacity: 1 })
        layer.on("mouseover", () => {
          layer.setStyle({ color: "#221a12", weight: 2 }); layer.bringToFront()
          layer.setTooltipContent(d && d.real
            ? `<div class="tt-name">${d.n}</div><div class="tt-row"><span>Monto</span><b>${fmtCOP(d.monto)} COP</b></div><div class="tt-row"><span>Directa</span><b>${fmtPct(d.pct)}</b></div><div class="tt-bar"><span style="width:${Math.min(100,d.pct)}%;background:${colorFor(d.pct/100)}"></span></div>`
            : `<div class="tt-name">${d.n}</div><div class="tt-sub">sin datos en la muestra actual</div>`)
          marcar(3, "tooltip con monto y % activo")
        })
        layer.on("mouseout", () => { layers.resetStyle(layer) })
        layer.on("click", e => { L.DomEvent.stopPropagation(e); setSel(idx); if (onSelectDepto && d) onSelectDepto(d.n) })
      },
    }).addTo(map)
    layersRef.current = layers
    marcar(1, "escala continua 0–100% sobre polígonos reales")
    marcar(2, "GeoJSON real 33 territorios (1.7MB) servido local")
  }, [geo, porId])

  useEffect(() => {
    const layers = layersRef.current
    if (!layers || !geo) return
    layers.eachLayer(l => {
      const idx = geo.features.indexOf(l.feature)
      if (idx === sel) l.setStyle({ color: "#221a12", weight: 2.4 })
      else layers.resetStyle(l)
    })
  }, [sel, geo])

  const filtrados = q ? filas.filter(d => norm(d.n).includes(norm(q))) : filas
  const selD = sel != null && geo ? porId[sel] : null
  const realesCount = filas.filter(d => d.real).length
  const nVerif = ca.filter(Boolean).length

  if (!token) return null
  if (isLoading || !geo) return <div className="rf15"><div style={{ padding: 18 }}>Cargando geografía real y datos…</div></div>
  if (isError || geoErr) return <div className="rf15"><div style={{ padding: 18 }}>No se pudo cargar el mapa ({geoErr || "API"}). Revisa tu access.</div></div>

  return (
    <div className="rf15" ref={wrapRef}>
      <div className="topbar"><span className="tb-id">RF-15 · MAPA COROPLÉTICO REAL</span><span className="tb-sep">/</span><span className="chip">GEOJSON 33 · DATOS API</span><span className="tb-right"><span className="chip">{realesCount}/33 CON DATOS</span><span className="chip state"><span className="dot" />{nVerif}/4 CA</span></span></div>
      <header>
        <div className="rf-box"><div className="rf-num">RF-15</div><div className="rf-sub">FUNCIONAL · SPRINT 3</div></div>
        <div className="head-mid">
          <div className="kicker">ROJO OSCURO = ALTA CONTRATACIÓN DIRECTA</div>
          <h1>Contratación directa por territorio</h1>
          <p className="hist"><b>Historia —</b> “Como usuario, quiero ver un mapa que pinte los territorios según el % de contratación directa.” Clic filtra el dashboard.</p>
        </div>
        <dl className="head-meta"><dt>FUENTE</dt><dd>/api/optimized/mapa-directa/</dd><dt>GEO</dt><dd>/colombia.geojson 33</dd><dt>DEPENDE</dt><dd>RF-12</dd></dl>
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
          <div className="rk-list">{filtrados.map((d, i) => (<button key={d.n} onClick={() => { setSel(geo.features.findIndex(f => (f.properties?.name || "") === d.n)); if (onSelectDepto) onSelectDepto(d.n) }} className={`rk-item ${selD && selD.n === d.n ? "sel" : ""}`}><span className="rk-n">{String(i + 1).padStart(2, "0")}</span><span><span className="rk-name">{d.n}</span></span><span className="rk-pct">{d.real ? fmtPct(d.pct) : "—"}</span></button>))}</div>
        </aside>
      </main>
    </div>
  )
}
