import { useState, useMemo } from "react"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import brutoNeto from "../data/bruto_neto.json"
import tiendaPerfecta from "../data/tienda_perfecta.json"
import sellin from "../data/sellin.json"
import marcasNacional from "../data/marcas_nacional.json"
import { formatMXN } from "../utils/helpers"

const CAT_ORDER = ["Todas","Bebidas","Dolor","Gripe y Resfrio","Gastro","Cuidado Capilar","Cuidado de la Piel","Formulas Infantiles","Otras"]

const METRICS = [
  { id: "so_neto_w12", label: "SO Neto W12", group: "Sell-Out" },
  { id: "so_neto_ytd", label: "SO Neto YTD", group: "Sell-Out" },
  { id: "so_bruto_w12", label: "SO Bruto W12", group: "Sell-Out" },
  { id: "so_bruto_ytd", label: "SO Bruto YTD", group: "Sell-Out" },
  { id: "yoy_neto", label: "YoY Neto %", group: "Sell-Out" },
  { id: "yoy_bruto", label: "YoY Bruto %", group: "Sell-Out" },
  { id: "pct_bruto_neto", label: "% Bruto a Neto", group: "Bruto a Neto" },
  { id: "coverage", label: "Cobertura (dias)", group: "Inventario" },
  { id: "stock", label: "Stock (uds)", group: "Inventario" },
  { id: "tp_score", label: "TP Score %", group: "Tienda Perfecta" },
  { id: "tp_dispo", label: "TP Dispo %", group: "Tienda Perfecta" },
  { id: "tp_precio", label: "TP Precio %", group: "Tienda Perfecta" },
  { id: "tp_exhib", label: "TP Exhibicion %", group: "Tienda Perfecta" },
]

function getMetricValue(accId, marca, metricId) {
  const bn = brutoNeto[accId]?.marcas?.find(m => m.marca === marca)
  const inv = inventory[accId]?.skus?.[marca]
  const tp = tiendaPerfecta[accId]?.marcas_detalle?.find(m => m.marca === marca)
  switch (metricId) {
    case "so_neto_w12": return bn?.neto_w12 || 0
    case "so_neto_ytd": return bn?.neto_ytd || 0
    case "so_bruto_w12": return bn?.bruto_w12 || 0
    case "so_bruto_ytd": return bn?.bruto_ytd || 0
    case "yoy_neto": return bn?.yoy_neto || 0
    case "yoy_bruto": return bn?.yoy_bruto || 0
    case "pct_bruto_neto": return bn?.pct_trade_ytd || 0
    case "coverage": return inv?.coverage_days || 0
    case "stock": return inv?.stock_units || 0
    case "tp_score": return tp?.tp_score_pct || 0
    case "tp_dispo": return tp?.dispo_pct || 0
    case "tp_precio": return tp?.precio_ok_pct || 0
    case "tp_exhib": return tp?.exhibicion_pct || 0
    default: return 0
  }
}

function formatVal(val, metricId) {
  if (["yoy_neto","yoy_bruto","pct_bruto_neto","tp_score","tp_dispo","tp_precio","tp_exhib"].includes(metricId)) return val.toFixed(1) + "%"
  if (["coverage"].includes(metricId)) return val + "d"
  if (["stock"].includes(metricId)) return val.toLocaleString()
  return formatMXN(val, true)
}

function downloadExcel(rows, selectedMetrics, filename) {
  const headers = ["Cuenta", "Marca", "Categoria", ...selectedMetrics.map(m => METRICS.find(x => x.id === m)?.label || m)]
  let csv = headers.join(",") + "\n"
  rows.forEach(r => {
    csv += [r.cuenta, r.marca, r.cat, ...selectedMetrics.map(m => r.values[m] || 0)].join(",") + "\n"
  })
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename + ".csv"
  link.click()
}

export default function CuboConsultas() {
  const [selAccounts, setSelAccounts] = useState(accounts.map(a => a.id))
  const [selCat, setSelCat] = useState("Todas")
  const [selMetrics, setSelMetrics] = useState(["so_neto_ytd", "yoy_neto", "coverage", "tp_score"])
  const [sortBy, setSortBy] = useState("so_neto_ytd")
  const [sortDir, setSortDir] = useState("desc")

  function toggleAccount(id) {
    setSelAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleMetric(id) {
    setSelMetrics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const rows = useMemo(() => {
    const result = []
    selAccounts.forEach(accId => {
      const acc = accounts.find(a => a.id === accId)
      const marcas = Object.keys(sellout[accId]?.skus || {})
      marcas.forEach(marca => {
        const cat = marcasNacional[marca]?.categoria_comercial || "Otras"
        if (selCat !== "Todas" && cat !== selCat) return
        const values = {}
        selMetrics.forEach(m => { values[m] = getMetricValue(accId, marca, m) })
        result.push({ accId, cuenta: acc.name, marca, cat, values })
      })
    })
    result.sort((a, b) => {
      const va = a.values[sortBy] || 0
      const vb = b.values[sortBy] || 0
      return sortDir === "desc" ? vb - va : va - vb
    })
    return result
  }, [selAccounts, selCat, selMetrics, sortBy, sortDir])

  const metricGroups = {}
  METRICS.forEach(m => {
    if (!metricGroups[m.group]) metricGroups[m.group] = []
    metricGroups[m.group].push(m)
  })

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Cubo de Consultas</div>
      <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 16 }}>Selecciona cuentas, categorias y metricas. Cruza las variables que necesites y descarga a Excel.</div>

      {/* FILTROS */}
      <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* Cuentas */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", marginBottom: 6 }}>Cuentas</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setSelAccounts(selAccounts.length === accounts.length ? [] : accounts.map(a => a.id))} className={"btn " + (selAccounts.length === accounts.length ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "3px 8px" }}>Todas</button>
              {accounts.map(acc => (
                <button key={acc.id} onClick={() => toggleAccount(acc.id)} className={"btn " + (selAccounts.includes(acc.id) ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "3px 8px" }}>{acc.name.split(" ")[0]}</button>
              ))}
            </div>
          </div>
          {/* Categorias */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", marginBottom: 6 }}>Categoria Comercial</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CAT_ORDER.map(cat => (
                <button key={cat} onClick={() => setSelCat(cat)} className={"btn " + (selCat === cat ? "btn-primary" : "btn-secondary")} style={{ fontSize: 10, padding: "3px 8px" }}>{cat}</button>
              ))}
            </div>
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

      {/* RESULTADOS + DOWNLOAD */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{rows.length} registros</span>
            <span style={{ fontSize: 11, color: "var(--silver)", marginLeft: 8 }}>{selAccounts.length} cuentas · {selCat} · {selMetrics.length} metricas</span>
          </div>
          <button className="btn btn-primary" onClick={() => downloadExcel(rows, selMetrics, "KAM_Cubo_" + new Date().toISOString().slice(0,10))} style={{ fontSize: 11, padding: "6px 16px" }}>Descargar Excel</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => { setSortBy("cuenta"); setSortDir(sortBy === "cuenta" && sortDir === "asc" ? "desc" : "asc") }}>Cuenta</th>
                <th>Marca</th>
                <th>Categoria</th>
                {selMetrics.map(m => {
                  const meta = METRICS.find(x => x.id === m)
                  return <th key={m} style={{ textAlign: "right", cursor: "pointer" }} onClick={() => { setSortBy(m); setSortDir(sortBy === m && sortDir === "desc" ? "asc" : "desc") }}>{meta?.label}{sortBy === m ? (sortDir === "desc" ? " ▼" : " ▲") : ""}</th>
                })}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.cuenta.split(" ")[0]}</td>
                  <td style={{ fontWeight: 700 }}>{r.marca}</td>
                  <td><span style={{ fontSize: 10, color: "var(--silver)" }}>{r.cat}</span></td>
                  {selMetrics.map(m => {
                    const val = r.values[m] || 0
                    const isYoy = m.includes("yoy")
                    const isPct = m.includes("pct") || m.includes("tp_")
                    const color = isYoy ? (val >= 0 ? "var(--success)" : "var(--critical)") : undefined
                    return <td key={m} style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: isYoy || isPct ? 700 : 400, color }}>{formatVal(val, m)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 && <div style={{ fontSize: 11, color: "var(--silver)", marginTop: 8 }}>Mostrando primeros 100 de {rows.length} registros. Descarga Excel para ver todos.</div>}
        </div>
      </div>
    </div>
  )
}
