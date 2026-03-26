import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import { formatMXN, formatPct, getAccountHealth, getHealthLabel, getLastWeekSellout, getPrevWeekSellout, getAvgCoverage } from "../utils/helpers"

const SKU_COLORS = { "Alliviax": "#1D9E75", "Cicatricure": "#185FA5", "XL-3": "#BA7517", "Suerox": "#E24B4A", "Tio Nacho": "#7F77DD" }
const statusMap = { completada: { label: "Completada", cls: "chip-green" }, en_curso: { label: "En curso", cls: "chip-amber" }, pendiente: { label: "Pendiente", cls: "chip-gray" } }

export default function Account360({ accountId, onBack, onGoToAgent }) {
  const account = accounts.find(a => a.id === accountId)
  const inv = inventory[accountId]
  const fund = funds[accountId]
  const so = sellout[accountId]
  const health = getAccountHealth(accountId, inventory, funds)
  const lastWeekSO = getLastWeekSellout(sellout, accountId)
  const prevWeekSO = getPrevWeekSellout(sellout, accountId)
  const deltaSO = ((lastWeekSO - prevWeekSO) / prevWeekSO) * 100
  const avgCov = getAvgCoverage(inventory, accountId)

  const chartData = useMemo(() => so.weeks.map((week, i) => {
    const entry = { week }
    Object.entries(so.skus).forEach(([sku, vals]) => { entry[sku] = Math.round(vals[i] / 1000) })
    return entry
  }), [so])

  return (
    <div>
      <div className="breadcrumb">
        <a onClick={onBack}>Dashboard</a><span>›</span><span>{account.name}</span>
      </div>
      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="account-icon" style={{ background: account.color, width: 46, height: 46, fontSize: 13, borderRadius: 10 }}>{account.logo_initials}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{account.name}</div>
            <div style={{ fontSize: 12, color: "var(--gray-400)" }}>{account.type} · {account.stores.toLocaleString()} tiendas · KAM: {account.kam} · Comprador: {account.buyer}</div>
          </div>
          <span className={`health-badge health-${health}`} style={{ marginLeft: 8 }}>
            <span className={`health-dot dot-${health}`} />{getHealthLabel(health)}
          </span>
        </div>
        <button className="btn btn-primary" onClick={onGoToAgent}>Abrir Agente IA →</button>
      </div>
      <div className="metric-grid" style={{ marginBottom: 16 }}>
        <div className="metric-card">
          <div className="metric-label">Sell-Out Sem. 47</div>
          <div className="metric-value">{formatMXN(lastWeekSO, true)}</div>
          <div className={`metric-delta ${deltaSO >= 0 ? "delta-up" : "delta-down"}`}>{deltaSO >= 0 ? "▲" : "▼"} {Math.abs(deltaSO).toFixed(1)}% vs sem. anterior</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Cobertura prom.</div>
          <div className="metric-value">{avgCov.toFixed(0)} dias</div>
          <div className={`metric-delta ${avgCov >= 14 ? "delta-up" : "delta-down"}`}>{avgCov >= 14 ? "Saludable" : avgCov >= 7 ? "Atencion" : "Riesgo quiebre"}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ejecucion fondos</div>
          <div className="metric-value" style={{ color: fund.execution_pct < 50 ? "var(--red)" : fund.execution_pct < 70 ? "var(--amber)" : "inherit" }}>{formatPct(fund.execution_pct)}</div>
          <div className="metric-sub">{formatMXN(fund.executed_ytd_mxn, true)} de {formatMXN(fund.annual_committed_mxn, true)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Objetivo anual</div>
          <div className="metric-value">{formatMXN(account.annual_target_mxn, true)}</div>
          <div className="metric-sub">{account.type}</div>
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-header">
            <div><div className="section-title">Sell-Out por SKU</div><div className="section-sub">Semanas S40-S47 · Miles MXN</div></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEEDE9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888780" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DDDDD8" }} formatter={(v) => [`$${v}K`, ""]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.keys(so.skus).map(sku => (
                <Line key={sku} type="monotone" dataKey={sku} stroke={SKU_COLORS[sku] || "#888780"} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-header">
            <div><div className="section-title">Inventario por SKU</div><div className="section-sub">Stock actual y dias de cobertura</div></div>
          </div>
          <table className="data-table">
            <thead><tr><th>SKU</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>Cobertura</th><th style={{ textAlign: "center" }}>Estado</th></tr></thead>
            <tbody>
              {Object.entries(inv.skus).map(([sku, data]) => {
                const cov = data.coverage_days
                const status = cov === 0 ? "sin-data" : cov < 7 ? "red" : cov < 14 ? "amber" : "green"
                const statusLabel = cov === 0 ? "-" : cov < 7 ? "Critico" : cov < 14 ? "Atencion" : "OK"
                const chipCls = status === "red" ? "chip-red" : status === "amber" ? "chip-amber" : status === "green" ? "chip-green" : "chip-gray"
                return (
                  <tr key={sku}>
                    <td style={{ fontWeight: 500 }}>{sku}</td>
                    <td style={{ textAlign: "right" }}>{data.stock_units > 0 ? data.stock_units.toLocaleString() : "-"}</td>
                    <td style={{ textAlign: "right" }}>{cov > 0 ? `${cov} dias` : "-"}</td>
                    <td style={{ textAlign: "center" }}>{cov > 0 && <span className={`chip ${chipCls}`}>{statusLabel}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="section-header">
          <div><div className="section-title">Plan de Fondos de Inversion</div><div className="section-sub">{formatMXN(fund.annual_committed_mxn)} comprometidos · {formatPct(fund.execution_pct)} ejecutado</div></div>
        </div>
        <table className="data-table">
          <thead><tr><th>Actividad</th><th style={{ textAlign: "right" }}>Presupuesto</th><th style={{ textAlign: "right" }}>Ejecutado</th><th style={{ textAlign: "right" }}>Avance</th><th style={{ textAlign: "center" }}>Estado</th></tr></thead>
          <tbody>
            {fund.activities.map((act, i) => {
              const pct = act.budget > 0 ? (act.executed / act.budget) * 100 : 0
              const s = statusMap[act.status]
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{act.name}</td>
                  <td style={{ textAlign: "right" }}>{formatMXN(act.budget, true)}</td>
                  <td style={{ textAlign: "right" }}>{formatMXN(act.executed, true)}</td>
                  <td style={{ textAlign: "right" }}>{formatPct(pct)}</td>
                  <td style={{ textAlign: "center" }}><span className={`chip ${s.cls}`}>{s.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
