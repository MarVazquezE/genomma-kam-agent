import { useMemo, useState } from "react"
import { ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import sellin from "../data/sellin.json"
import brutoNeto from "../data/bruto_neto.json"
import tiendaPerfecta from "../data/tienda_perfecta.json"
import brandMap from "../data/brand_map.json"
import marcasNacional from "../data/marcas_nacional.json"
import { formatMXN, formatPct, getAccountHealth, getHealthLabel, getLastWeekSellout, getPrevWeekSellout, getAvgCoverage } from "../utils/helpers"

const SKU_COLORS = ["#6366F1","#14B8A6","#F59E0B","#F43F5E","#8B5CF6","#06B6D4","#F97316","#EC4899","#10B981","#3B82F6","#EF4444","#84CC16"]
const CAT_ORDER = ["Bebidas","Dolor","Gripe y Resfrio","Gastro","Cuidado Capilar","Cuidado de la Piel","Formulas Infantiles","Otras"]

export default function Account360({ accountId, onBack, onGoToAgent, onGoToPresentacion, onGoToOnePager }) {
  const [selectedCat, setSelectedCat] = useState("Todas")
  const account = accounts.find(a => a.id === accountId)
  const inv = inventory[accountId]
  const fund = funds[accountId]
  const so = sellout[accountId]
  const si = sellin[accountId]
  const bn = brutoNeto[accountId]
  const tp = tiendaPerfecta[accountId]
  const bm = brandMap[accountId] || []
  const health = getAccountHealth(accountId, inventory, funds)
  const lastWeekSO = getLastWeekSellout(sellout, accountId)
  const prevWeekSO = getPrevWeekSellout(sellout, accountId)
  const deltaSO = prevWeekSO > 0 ? ((lastWeekSO - prevWeekSO) / prevWeekSO) * 100 : 0
  const avgCov = getAvgCoverage(inventory, accountId)

  // Get all marcas for this account with categories
  const allMarcas = Object.keys(so.skus)
  const catsAvailable = ["Todas", ...CAT_ORDER.filter(c => allMarcas.some(m => (marcasNacional[m]?.categoria_comercial || "Otras") === c))]
  const filteredMarcas = selectedCat === "Todas" ? allMarcas : allMarcas.filter(m => (marcasNacional[m]?.categoria_comercial || "Otras") === selectedCat)

  // Chart data: bars=LY, line=TY for filtered marcas
  const chartData = useMemo(() => so.weeks.map((week, i) => {
    let ty = 0, ly = 0
    filteredMarcas.forEach(marca => {
      const val = so.skus[marca]?.[i] || 0
      ty += val
      const bnm = bn?.marcas?.find(m => m.marca === marca)
      const yoy = bnm?.yoy_neto || 0
      ly += yoy !== 0 ? Math.round(val / (1 + yoy/100)) : val
    })
    return { week, "2026": Math.round(ty/1000), "2025": Math.round(ly/1000) }
  }), [so, filteredMarcas, bn])

  // Build marca table data
  const marcaRows = filteredMarcas.map(marca => {
    const weeks = so.skus[marca] || []
    const w12 = weeks[weeks.length-1] || 0
    const bnm = bn?.marcas?.find(m => m.marca === marca)
    const invM = inv?.skus?.[marca]
    const tpM = tp?.marcas_detalle?.find(m => m.marca === marca)
    const bmM = bm.find(m => m.marca === marca)
    return {
      marca, cat: marcasNacional[marca]?.categoria_comercial || "Otras",
      neto_w12: bnm?.neto_w12 || w12, neto_ytd: bnm?.neto_ytd || 0,
      bruto_w12: bnm?.bruto_w12 || 0, bruto_ytd: bnm?.bruto_ytd || 0,
      yoy_neto: bnm?.yoy_neto || 0, yoy_bruto: bnm?.yoy_bruto || 0,
      pct_trade: bnm?.pct_trade_ytd || 0,
      coverage: invM?.coverage_days || 0, stock: invM?.stock_units || 0,
      tp_score: tpM?.tp_score_pct || 0,
      categoria_mapa: bmM?.categoria || "proteger",
    }
  }).sort((a,b) => b.neto_ytd - a.neto_ytd)

  const totalNetoYTD = marcaRows.reduce((s,r) => s+r.neto_ytd, 0)
  const totalBrutoYTD = marcaRows.reduce((s,r) => s+r.bruto_ytd, 0)
  const totalNetoW12 = marcaRows.reduce((s,r) => s+r.neto_w12, 0)

  return (
    <div>
      <div className="breadcrumb">
        <a onClick={onBack}>Dashboard</a><span>{"›"}</span><span>{account.name}</span>
      </div>

      {/* HEADER */}
      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="account-icon" style={{ background: account.color, width: 46, height: 46, fontSize: 13, borderRadius: 10 }}>{account.logo_initials}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{account.name}</div>
            <div style={{ fontSize: 12, color: "var(--silver)" }}>{account.type} · {account.stores.toLocaleString()} tiendas · KAM: {account.kam} · Comprador: {account.buyer}</div>
          </div>
          <span className={"health-badge health-" + health} style={{ marginLeft: 8 }}>
            <span className={"health-dot dot-" + health} />{getHealthLabel(health)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={onGoToAgent}>Agente IA</button>
          <button className="btn btn-secondary" onClick={onGoToPresentacion}>Presentacion</button>
          <button className="btn btn-secondary" onClick={onGoToOnePager} style={{ background: "#E0E7FF", color: "#4F46E5" }}>One-Pager</button>
        </div>
      </div>

      {/* KPIs DE CABECERA — Sell Out Neto, Sell Out Bruto, Sell In Neto, Inventario, TP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        <div className="metric-card" style={{ borderLeft: "3px solid var(--primary)" }}>
          <div className="metric-label">Sell-Out Neto YTD</div>
          <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{formatMXN(bn?.total_neto_ytd || 0, true)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: "var(--silver)" }}>W12: {formatMXN(bn?.total_neto_w12 || 0, true)}</div>
        </div>
        <div className="metric-card" style={{ borderLeft: "3px solid var(--info)" }}>
          <div className="metric-label">Sell-Out Bruto YTD</div>
          <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{formatMXN(bn?.total_bruto_ytd || 0, true)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: "var(--warning)" }}>Trade: {bn?.pct_trade_ytd || 0}%</div>
        </div>
        <div className="metric-card" style={{ borderLeft: "3px solid var(--cyan)" }}>
          <div className="metric-label">Sell-In Neto Q1 vs Obj</div>
          <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{formatMXN(si?.real_neto_q1 || si?.real_trim || 0, true)}</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            <span style={{ color: "var(--silver)" }}>Obj SI Neto Anual: </span>
            <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--obsidian)" }}>{formatMXN(si?.objetivo_neto_anual || si?.objetivo_acum || 0, true)}</span>
          </div>
        </div>
        <div className="metric-card" style={{ borderLeft: "3px solid " + (avgCov >= 14 ? "var(--success)" : avgCov >= 7 ? "var(--warning)" : "var(--critical)") }}>
          <div className="metric-label">Cobertura Inventario Prom.</div>
          <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{avgCov.toFixed(0)} dias</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: avgCov >= 14 ? "var(--success)" : "var(--critical)" }}>{avgCov >= 21 ? "En piso" : avgCov >= 14 ? "Saludable" : avgCov >= 7 ? "Atencion" : "Riesgo quiebre"}</div>
        </div>
        <div className="metric-card" style={{ borderLeft: "3px solid " + (tp?.score_general_pct >= 75 ? "var(--success)" : tp?.score_general_pct >= 60 ? "var(--warning)" : "var(--critical)") }}>
          <div className="metric-label">Tienda Perfecta</div>
          <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: tp?.score_general_pct >= 75 ? "var(--success)" : tp?.score_general_pct >= 60 ? "var(--warning)" : "var(--critical)" }}>{tp?.score_general_pct?.toFixed(0) || 0}%</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: "var(--silver)" }}>Obj: {tp?.objetivo_pct || 85}% · {tp?.tendencia || "—"}</div>
        </div>
      </div>

      {/* FILTRO POR CATEGORIA COMERCIAL */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Filtrar por categoria:</span>
          {catsAvailable.map(c => (
            <button key={c} onClick={() => setSelectedCat(c)} className={"btn " + (selectedCat === c ? "btn-primary" : "btn-secondary")} style={{ fontSize: 11, padding: "3px 10px" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* GRAFICA SELL-OUT NETO: BARRAS 2025, LINEA 2026 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Sell-Out Neto Semanal — {selectedCat === "Todas" ? "Todas las categorias" : selectedCat} (miles MXN)</div>
        <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 12 }}>Barras grises = 2025 (LY) · Linea indigo = 2026 (TY)</div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888780" }} />
            <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => ["$" + v + "K MXN", ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="2025" fill="#E2E8F0" name="2025 (LY)" radius={[4,4,0,0]} />
            <Line type="monotone" dataKey="2026" stroke="#4F46E5" strokeWidth={3} name="2026 (TY)" dot={{ r: 4, fill: "#4F46E5" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* TABLA POR MARCA: SO Neto YTD (vs LY), SO Neto LW (vs LY), Inventario, TP, Trade */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Performance por Marca — Sell-Out Neto</div>
        <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 12 }}>{selectedCat === "Todas" ? "Todas las categorias" : selectedCat} · {filteredMarcas.length} marcas · W12 2026</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Categoria</th>
              <th style={{ textAlign: "right" }}>SO Neto YTD</th>
              <th style={{ textAlign: "right" }}>vs LY</th>
              <th style={{ textAlign: "right" }}>SO Neto LW</th>
              <th style={{ textAlign: "right" }}>vs LY</th>
              <th style={{ textAlign: "right" }}>Inventario</th>
              <th style={{ textAlign: "right" }}>TP</th>
              <th style={{ textAlign: "right" }}>% Trade</th>
              <th style={{ textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {marcaRows.map((r, i) => {
              const covC = r.coverage < 7 ? "var(--critical)" : r.coverage < 14 ? "var(--warning)" : "var(--success)"
              const tpC = r.tp_score >= 75 ? "var(--success)" : r.tp_score >= 60 ? "var(--warning)" : "var(--critical)"
              const catCfg = { revertir: { bg: "var(--critical-light)", color: "var(--critical)", label: "Revertir" }, proteger: { bg: "var(--warning-light)", color: "#92400E", label: "Proteger" }, capitalizar: { bg: "var(--success-light)", color: "var(--success)", label: "Capitalizar" } }[r.categoria_mapa] || { bg: "var(--pearl)", color: "var(--silver)", label: "—" }
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{r.marca}</td>
                  <td><span style={{ fontSize: 10, color: "var(--silver)" }}>{r.cat}</span></td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{formatMXN(r.neto_ytd, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: r.yoy_neto >= 0 ? "var(--success)" : "var(--critical)" }}>{r.yoy_neto > 0 ? "+" : ""}{r.yoy_neto}%</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatMXN(r.neto_w12, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: r.yoy_neto >= 0 ? "var(--success)" : "var(--critical)" }}>{r.yoy_neto > 0 ? "+" : ""}{r.yoy_neto}%</td>
                  <td style={{ textAlign: "right" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: covC }}>{r.coverage}d</span></td>
                  <td style={{ textAlign: "right" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: tpC }}>{r.tp_score > 0 ? r.tp_score.toFixed(0)+"%" : "—"}</span></td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: r.pct_trade > 25 ? "var(--critical)" : "var(--silver)" }}>{r.pct_trade}%</td>
                  <td style={{ textAlign: "center" }}><span style={{ fontSize: 9, background: catCfg.bg, color: catCfg.color, padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>{catCfg.label}</span></td>
                </tr>
              )
            })}
            <tr style={{ background: "var(--pearl)", fontWeight: 800 }}>
              <td style={{ fontWeight: 800 }}>TOTAL</td>
              <td></td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800 }}>{formatMXN(totalNetoYTD, true)}</td>
              <td></td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800 }}>{formatMXN(totalNetoW12, true)}</td>
              <td colSpan={5}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* INVENTARIO POR MARCA */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Inventario por Marca</div>
          <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 12 }}>Stock actual, dias de cobertura y estado · Piso: 21 dias</div>
          <table className="data-table">
            <thead><tr><th>Marca</th><th style={{ textAlign: "right" }}>Stock (uds)</th><th style={{ textAlign: "right" }}>Cobertura</th><th style={{ textAlign: "center" }}>Estado</th></tr></thead>
            <tbody>
              {Object.entries(inv.skus).filter(([sku]) => selectedCat === "Todas" || (marcasNacional[sku]?.categoria_comercial || "Otras") === selectedCat).map(([sku, data]) => {
                const cov = data.coverage_days
                const chipCls = cov < 7 ? "chip-red" : cov < 14 ? "chip-amber" : "chip-green"
                const label = cov < 7 ? "Critico" : cov < 14 ? "Atencion" : cov >= 21 ? "En piso" : "OK"
                return (
                  <tr key={sku}>
                    <td style={{ fontWeight: 600 }}>{sku}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{data.stock_units > 0 ? data.stock_units.toLocaleString() : "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{cov > 0 ? cov + "d" : "—"}</td>
                    <td style={{ textAlign: "center" }}>{cov > 0 && <span className={"chip " + chipCls}>{label}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* TIENDA PERFECTA POR MARCA */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Tienda Perfecta por Marca</div>
          <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 12 }}>Score de ejecucion en PDV · Obj: {tp?.objetivo_pct || 85}%</div>
          {tp ? (
            <table className="data-table">
              <thead><tr><th>Marca</th><th style={{ textAlign: "right" }}>Dispo</th><th style={{ textAlign: "right" }}>Precio</th><th style={{ textAlign: "right" }}>Exhib</th><th style={{ textAlign: "right" }}>TP Score</th></tr></thead>
              <tbody>
                {tp.marcas_detalle.filter(m => selectedCat === "Todas" || (marcasNacional[m.marca]?.categoria_comercial || "Otras") === selectedCat).map((m, i) => {
                  const c = m.tp_score_pct >= 75 ? "var(--success)" : m.tp_score_pct >= 60 ? "var(--warning)" : "var(--critical)"
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{m.marca}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{m.dispo_pct.toFixed(0)}%</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{m.precio_ok_pct.toFixed(0)}%</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{m.exhibicion_pct.toFixed(0)}%</td>
                      <td style={{ textAlign: "right" }}><span style={{ fontWeight: 800, color: c, fontFamily: "var(--font-mono)", fontSize: 12 }}>{m.tp_score_pct.toFixed(0)}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div style={{ color: "var(--silver)", fontSize: 12 }}>Sin datos de Tienda Perfecta</div>}
        </div>
      </div>

      {/* FONDOS DE INVERSION */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Plan de Fondos de Inversion</div>
        <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 12 }}>Presupuesto anual: {formatMXN(fund.annual_committed_mxn)} · Ejecutado: {formatPct(fund.execution_pct)}</div>
        <table className="data-table">
          <thead><tr><th>Actividad</th><th style={{ textAlign: "right" }}>Presupuesto</th><th style={{ textAlign: "right" }}>Ejecutado</th><th style={{ textAlign: "right" }}>Avance</th><th style={{ textAlign: "center" }}>Estado</th></tr></thead>
          <tbody>
            {fund.activities.map((act, i) => {
              const pct = act.budget > 0 ? (act.executed / act.budget) * 100 : 0
              const cls = act.status === "completada" ? "chip-green" : act.status === "en_curso" ? "chip-amber" : "chip-gray"
              const label = act.status === "completada" ? "Completada" : act.status === "en_curso" ? "En curso" : "Pendiente"
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{act.name}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatMXN(act.budget, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatMXN(act.executed, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatPct(pct)}</td>
                  <td style={{ textAlign: "center" }}><span className={"chip " + cls}>{label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
