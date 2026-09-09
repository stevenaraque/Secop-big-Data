import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "./MapaRF15.css"

const API = "http://127.0.0.1:8000/api"
async function fetchMapa(token) {
  const r = await fetch(`${API}/optimized/mapa-directa/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Error mapa")
  return r.json()
}

/* escala continua papel -> rojo oscuro (de tu HTML) */
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

const nf1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat("es-CO")
const fmtPct = (p) => nf1.format(Number(p) || 0) + " %"
const fmtCOP = (v) => "$" + nf0.format(Math.round(Number(v) || 0))
const norm = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim()

/* vinculación de nombres del GeoJSON (de tu HTML) */
const KNOWN = ['AMAZONAS','ANTIOQUIA','ARAUCA','ATLANTICO','BOGOTA','BOLIVAR','BOYACA','CALDAS','CAQUETA',
 'CASANARE','CAUCA','CESAR','CHOCO','CORDOBA','CUNDINAMARCA','GUAINIA','GUAVIARE','HUILA','GUAJIRA',
 'MAGDALENA','META','NARINO','NORTE DE SANTANDER','PUTUMAYO','QUINDIO','RISARALDA','SAN ANDRES','SANTANDER',
 'SUCRE','TOLIMA','VALLE','VAUPES','VICHADA']
const ALIAS = {'BOGOTA':'BOGOTA','SANTAFE DE BOGOTA':'BOGOTA','SANTA FE DE BOGOTA':'BOGOTA',
 'GUAJIRA':'GUAJIRA','NORTE SANTANDER':'NORTE DE SANTANDER','VALLE':'VALLE','VALLE DEL CAUCA':'VALLE',
 'SAN ANDRES Y PROVIDENCIA':'SAN ANDRES','ARCHIPIELAGO DE SAN ANDRES':'SAN ANDRES',
 'SAN ANDRES PROVIDENCIA Y SANTA CATALINA':'SAN ANDRES','SAN ANDRES Y PROVIDENCIA SANTA CATALINA':'SAN ANDRES'}
function matchName(raw) {
  const k = norm(raw)
  if (!k) return null
  if (ALIAS[k]) return ALIAS[k]
  if (KNOWN.includes(k)) return k
  const kk = k.replace(/ /g, "")
  for (const n of KNOWN) { if (kk.includes(n.replace(/ /g, ""))) return n }
  return null
}
function nameOf(props) {
  if (!props) return null
  const pref = ['NOMBRE_DPT','DPTO_CNMBR','DEPARTAMENTO','DPT_NOMBRE','NOMBDEP','NOMBRE','name','dpto','DPTO']
  for (const p of pref) { if (props[p] != null) { const m = matchName(props[p]); if (m) return m } }
  for (const k in props) { if (typeof props[k] === 'string') { const m = matchName(props[k]); if (m) return m } }
  return null
}

export default function MapaDirecta({ token, onSelectDepto }) {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mapa"],
    queryFn: () => fetchMapa(token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  })

  /* mapa base - vista completa siempre, con zoom habilitado */
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: false, minZoom: 4, maxZoom: 12, scrollWheelZoom: true })
    map.fitBounds([[-4.6, -82.6], [13.9, -66.7]])
    map.setMaxBounds([[-24, -102], [24, -38]])
    mapRef.current = map
    setTimeout(() => { try { map.invalidateSize(); map.fitBounds([[-4.6, -82.6], [13.9, -66.7]]) } catch (_) { /* noop */ } }, 150)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  /* capa coroplética con datos reales */
/* id estable del GeoJSON -> nombre normalizado (evita el problema de Ñ rota) */
const POR_ID = { CONAR: 'NARINO', COPUT: 'PUTUMAYO', COCHO: 'CHOCO', COGUA: 'GUAINIA', COVAU: 'VAUPES', COAMA: 'AMAZONAS', COLAG: 'GUAJIRA', COCES: 'CESAR', CONSA: 'NORTE DE SANTANDER', COARA: 'ARAUCA', COBOY: 'BOYACA', COVID: 'VICHADA', COCAU: 'CAUCA', COVAC: 'VALLE', COANT: 'ANTIOQUIA', COCOR: 'CORDOBA', COSUC: 'SUCRE', COBOL: 'BOLIVAR', COATL: 'ATLANTICO', COMAG: 'MAGDALENA', COSAP: 'SAN ANDRES', COCAQ: 'CAQUETA', COHUI: 'HUILA', COGUV: 'GUAVIARE', COCAL: 'CALDAS', COCAS: 'CASANARE', COMET: 'META', CODC: 'BOGOTA', COSAN: 'SANTANDER', COTOL: 'TOLIMA', COQUI: 'QUINDIO', COCUN: 'CUNDINAMARCA', CORIS: 'RISARALDA' }
function claveGeo(props) {
  if (props?.id && POR_ID[props.id]) return POR_ID[props.id]
  return matchName(nameOf(props) || props?.name || "")
}

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let vivo = true
    fetch("/colombia.geojson")
      .then((r) => { if (!r.ok) throw new Error("GeoJSON " + r.status); return r.json() })
      .then((fc) => {
        if (!vivo) return
        const reales = {}
        for (const d of (data?.mapa || [])) reales[norm(d.departamento)] = d
        // Bogotá D.C. alias -> mismo dato que Distrito Capital
        const bdc = reales[norm("Distrito Capital de Bogotá")] || reales[norm("Bogota D.C.")]
        if (bdc) reales[norm("Bogotá D.C.")] = bdc
        // alias VALLE y BOGOTA normalizados
        if (reales[norm("Valle del Cauca")] && !reales["VALLE"]) reales["VALLE"] = reales[norm("Valle del Cauca")]
        if (bdc && !reales["BOGOTA"]) reales["BOGOTA"] = bdc

        if (layersRef.current) { map.removeLayer(layersRef.current); layersRef.current = null }
        const layers = L.geoJSON(fc, {
          style: (f) => {
            const key = claveGeo(f.properties)
            const hit = key ? reales[key] : null
            return {
              color: "#fdfaf1", weight: 1.1,
              fillColor: hit ? colorFor(Number(hit.porcentaje_directa) / 100) : "#d9cfba",
              fillOpacity: 1,
            }
          },
          onEachFeature: (f, layer) => {
            const key = claveGeo(f.properties)
            const hit = key ? reales[key] : null
            const geoName = hit?.departamento || f.properties?.name || "Territorio"
            layer.bindTooltip("…", { sticky: true, direction: "top", className: "rf-tip" })
            layer.on("mouseover", () => {
              layer.setStyle({ color: "#221a12", weight: 2 })
              layer.bringToFront()
              layer.setTooltipContent(hit
                ? `<div class="tt-name">${hit.departamento}</div>`
                  + `<div class="tt-row"><span>Monto</span><b>${fmtCOP(hit.suma_total)} COP</b></div>`
                  + `<div class="tt-row"><span>Directa</span><b>${fmtPct(hit.porcentaje_directa)}</b></div>`
                  + `<div class="tt-bar"><span style="width:${Math.min(100, Number(hit.porcentaje_directa))}%;background:${colorFor(Number(hit.porcentaje_directa) / 100)}"></span></div>`
                : `<div class="tt-name">${geoName}</div><div class="tt-sub">sin datos en la muestra actual</div>`)
            })
            layer.on("mouseout", () => { layers.resetStyle(layer) })
            layer.on("click", (e) => {
              L.DomEvent.stopPropagation(e)
              if (hit && onSelectDepto) onSelectDepto(hit.departamento)
            })
          },
        }).addTo(map)
        layersRef.current = layers
        try { map.fitBounds(layers.getBounds(), { padding: [20, 20] }) } catch (_) { /* noop */ }
      })
      .catch(() => { /* deja el aviso en pantalla */ })
    return () => { vivo = false }
  }, [data, onSelectDepto])

  if (!token) return null

  return (
    <div className="rf15-simple">
      <div className="map-wrap">
        <div id="rf15-map" ref={mapElRef} />
        {(isLoading || isError) && (
          <div className="map-status">{isLoading ? "Cargando mapa…" : "No se pudo cargar /api/optimized/mapa-directa/. Revisa tu access."}</div>
        )}
        <div className="legend">
          <div className="t">% CONTRATACIÓN DIRECTA</div>
          <div className="bar" style={{ background: `linear-gradient(90deg,${STOPS.map((s) => `rgb(${s[1].join(",")}) ${Math.round(s[0] * 100)}%`).join(",")})` }} />
          <div className="tk"><span>0 %</span><span>50 %</span><span>100 %</span></div>
        </div>
      </div>
    </div>
  )
}
