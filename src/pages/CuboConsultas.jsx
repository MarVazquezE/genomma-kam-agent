import { useState, useMemo } from "react"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import brutoNeto from "../data/bruto_neto.json"
import tiendaPerfecta from "../data/tienda_perfecta.json"
import sellin from "../data/sellin.json"
import marcasNacional from "../data/marcas_nacional.json"
import cuboSellout from "../data/cubo_sellout.json"
import { formatMXN } from "../utils/helpers"

const CAT_ORDER = ["Todas","Bebidas","Dolor","Gripe y Resfrio","Gastro","Cuidado Capilar","Cuidado de la Piel","Formulas Infantiles","Otras"]

// All unique cadenas from cubo_sellout
const ALL_CADENAS = [...new Set(cuboSellout.map(r => r.cadena))].sort()

const METRICS = [
  { id: "neto_w12", label: "SO Neto W12", group: "Sell-Out" },
  { id: "neto_ytd", label: "SO Neto YTD", group: "Sell-Out" },
  { id: "bruto_w12", label: "SO Bruto W12", group: "Sell-Out" },
  { id: "bruto_ytd", label: "SO Bruto YTD", group: "Sell-Out" },
  { id: "yoy_neto_w12", label: "YoY Neto W12 %", group: "Sell-Out" },
  { id: "yoy_neto_ytd", label: "YoY Neto YTD %", group: "Sell-Out" },
  { id: "yoy_bruto_w12", label: "YoY Bruto W12 %", group: "Sell-Out" },
  { id: "pct_bruto_neto", label: "% Bruto a Neto Real", group: "Bruto a Neto" },
  { id: "bn_obj_pct", label: "% Bruto a Neto Obj G60", group: "Bruto a Neto" },
  { id: "bn_desviacion", label: "Desviacion BN (pts)", group: "Bruto a Neto" },
  { id: "obj_bruto_anual", label: "Obj Bruto Anual", group: "Bruto a Neto" },
  { id: "obj_neto_anual", label: "Obj Neto Anual", group: "Bruto a Neto" },
  { id: "coverage_days", label: "Cobertura (dias)", group: "Inventario" },
  { id: "stock_units", label: "Stock (uds)", group: "Inventario" },
  { id: "price_mxn", label: "Precio MXN", group: "Inventario" },
  { id: "tp_score", label: "TP Score %", group: "Tienda Perfecta" },
  { id: "tp_dispo", label: "Disponibilidad %", group: "Tienda Perfecta" },
  { id: "tp_precio", label: "Precio OK %", group: "Tienda Perfecta" },
  { id: "tp_exhib", label: "Exhibicion %", group: "Tienda Perfecta" },
  { id: "tp_plano", label: "Planograma %", group: "Tienda Perfecta" },
  { id: "ms_som_pct", label: "Share of Market %", group: "Market Share" },
  { id: "ms_competidor_som", label: "Share Competidor %", group: "Market Share" },
  { id: "ms_gap_pts", label: "Gap vs Lider (pts)", group: "Market Share" },
]

function formatVal(val, metricId) {
  if (["yoy_neto_w12","yoy_neto_ytd","yoy_bruto_w12","pct_bruto_neto","bn_obj_pct","tp_score","tp_dispo","tp_precio","tp_exhib","tp_plano","ms_som_pct","ms_competidor_som"].includes(metricId)) return val.toFixed(1) + "%"
  if (["bn_desviacion","ms_gap_pts"].includes(metricId)) return (val > 0 ? "+" : "") + val.toFixed(1) + " pts"
  if (["coverage_days"].includes(metricId)) return val + "d"
  if (["stock_units"].includes(metricId)) return val.toLocaleString()
  if (["price_mxn"].includes(metricId)) return "$" + val.toFixed(2)
  return formatMXN(val, true)
}

function downloadExcel(rows, selectedMetrics, filename) {
  const headers = ["Cadena", "Marca", "Categoria", ...selectedMetrics.map(m => METRICS.find(x => x.id === m)?.label || m)]
  let csv = headers.join(",") + "\n"
  rows.forEach(r => {
    csv += ['"' + r.cadena + '"', r.marca, r.cat, ...selectedMetrics.map(m => r[m] || 0)].join(",") + "\n"
  })
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename + ".csv"
  link.click()
}

export default function CuboConsultas() {
  const [selCadenas, setSelCadenas] = useState(ALL_CADENAS)
  const [selCat, setSelCat] = useState("Todas")
  const [selMetrics, setSelMetrics] = useState(["neto_ytd", "yoy_neto_ytd", "pct_bruto_neto"])
  const [sortBy, setSortBy] = useState("neto_ytd")
  const [sortDir, setSortDir] = useState("desc")
  const [searchMarca, setSearchMarca] = useState("")

  function toggleCadena(cadena) {
    setSelCadenas(prev => prev.includes(cadena) ? prev.filter(x => x !== cadena) : [...prev, cadena])
  }
  function toggleMetric(id) {
    setSelMetrics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const rows = useMemo(() => {
    return cuboSellout
      .filter(r => selCadenas.includes(r.cadena))
      .filter(r => {
        const cat = marcasNacional[r.marca]?.categoria_comercial || "Otras"
        return selCat === "Todas" || cat === selCat
      })
      .filter(r => !searchMarca || r.marca.toLowerCase().includes(searchMarca.toLowerCase()))
      .map(r => ({
        ...r,
        cat: marcasNacional[r.marca]?.categoria_comercial || "Otras",
      }))
      .sort((a, b) => {
        const va = a[sortBy] || 0
        const vb = b[sortBy] || 0
        return sortDir === "desc" ? vb - va : va - vb
      })
  }, [selCadenas, selCat, selMetrics, sortBy, sortDir, searchMarca])

  const metricGroups = {}
  METRICS.forEach(m => {
    if (!metricGroups[m.group]) metricGroups[m.group] = []
    metricGroups[m.group].push(m)
  })

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Cubo de Consultas</div>
      <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 16 }}>Datos reales de Qlik: {cuboSellout.length} registros · {ALL_CADENAS.length} cadenas · 52 marcas. Filtra, cruza y descarga a Excel.</div>

      {/* FILTROS */}
      <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", marginBottom: 6 }}>Cadenas ({selCadenas.length} de {ALL_CADENAS.length})</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setSelCadenas(selCadenas.length === ALL_CADENAS.length ? [] : [...ALL_CADENAS])} className={"btn " + (selCadenas.length === ALL_CADENAS.length ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "3px 8px" }}>Todas</button>
              {ALL_CADENAS.map(cad => (
                <button key={cad} onClick={() => toggleCadena(cad)} className={"btn " + (selCadenas.includes(cad) ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "3px 6px" }}>{cad.replace("Wal-Mart de México","WMT").replace("Cadena Comercial OXXO","OXXO").replace("Farmacias Del Ahorro","FDA").replace("Grupo Chedraui","Chedraui").replace("Grupo Soriana","Soriana").replace("Grupo Benavides","Benavides").replace("Sams Club","Sam's").replace("Supermercados Internacionales Heb","HEB").replace("Comercial City Fresko","City Fresko").replace("Comercializadora DAX","DAX").replace("Sanborns Hermanos","Sanborns").replace("Farmacos Nacionales","Farmacos Nac")}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", marginBottom: 6 }}>Categoria Comercial</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CAT_ORDER.map(cat => (
                <button key={cat} onClick={() => setSelCat(cat)} className={"btn " + (selCat === cat ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "3px 8px" }}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", marginBottom: 6 }}>Buscar Marca</div>
            <input type="text" value={searchMarca} onChange={e => setSearchMarca(e.target.value)} placeholder="Ej: NOVAMIL, SUEROX..." style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #E2E8F0", borderRadius: "var(--radius-sm)", width: 200 }} />
          </div>
        </div>
      </div>

      {/* METRICAS */}
      <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", marginBottom: 8 }}>Metricas (click para agregar/quitar columnas)</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {Object.entries(metricGroups).map(([group, metrics]) => (
            <div key={group}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--cyan)", textTransform: "uppercase", marginBottom: 4 }}>{group}</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {metrics.map(m => (
                  <button key={m.id} onClick={() => toggleMetric(m.id)} className={"btn " + (selMetrics.includes(m.id) ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "2px 7px" }}>{m.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RESULTADOS */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{rows.length} registros</span>
            <span style={{ fontSize: 11, color: "var(--silver)", marginLeft: 8 }}>{selCadenas.length} cadenas · {selCat} · {selMetrics.length} metricas</span>
          </div>
          <button className="btn btn-primary" onClick={() => downloadExcel(rows, selMetrics, "KAM_Cubo_W12_" + new Date().toISOString().slice(0,10))} style={{ fontSize: 11, padding: "6px 16px" }}>Descargar Excel</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => { setSortBy("cadena"); setSortDir(sortBy === "cadena" && sortDir === "asc" ? "desc" : "asc") }}>Cadena{sortBy === "cadena" ? (sortDir === "desc" ? " ▼" : " ▲") : ""}</th>
                <th style={{ cursor: "pointer" }} onClick={() => { setSortBy("marca"); setSortDir(sortBy === "marca" && sortDir === "asc" ? "desc" : "asc") }}>Marca{sortBy === "marca" ? (sortDir === "desc" ? " ▼" : " ▲") : ""}</th>
                <th>Categoria</th>
                {selMetrics.map(m => {
                  const meta = METRICS.find(x => x.id === m)
                  return <th key={m} style={{ textAlign: "right", cursor: "pointer" }} onClick={() => { setSortBy(m); setSortDir(sortBy === m && sortDir === "desc" ? "asc" : "desc") }}>{meta?.label}{sortBy === m ? (sortDir === "desc" ? " ▼" : " ▲") : ""}</th>
                })}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 11 }}>{r.cadena}</td>
                  <td style={{ fontWeight: 700 }}>{r.marca}</td>
                  <td><span style={{ fontSize: 10, color: "var(--silver)" }}>{r.cat}</span></td>
                  {selMetrics.map(m => {
                    const val = r[m] || 0
                    const isYoy = m.includes("yoy")
                    const isPct = m.includes("pct") || m.includes("tp_")
                    const color = isYoy ? (val >= 0 ? "var(--success)" : "var(--critical)") : undefined
                    return <td key={m} style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: isYoy || isPct ? 700 : 400, color }}>{formatVal(val, m)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && <div style={{ fontSize: 11, color: "var(--silver)", marginTop: 8 }}>Mostrando primeros 200 de {rows.length} registros. Descarga Excel para ver todos.</div>}
        </div>
      </div>
    </div>
  )
}
