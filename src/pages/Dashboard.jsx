import { useMemo } from "react"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import { formatMXN, getAccountHealth, getHealthLabel, getLastWeekSellout, getAvgCoverage, getCriticalSkus } from "../utils/helpers"

function AccountCard({ account, onSelect }) {
  const health = getAccountHealth(account.id, inventory, funds)
  const lastWeekSO = getLastWeekSellout(sellout, account.id)
  const avgCov = getAvgCoverage(inventory, account.id)
  const critSkus = getCriticalSkus(inventory, account.id)
  const fundExec = funds[account.id].execution_pct
  return (
    <div className="account-card" onClick={() => onSelect(account.id)}>
      <div className="account-card-header">
        <div className="account-icon" style={{ background: account.color }}>{account.logo_initials}</div>
        <div>
          <div className="account-name">{account.name}</div>
          <div className="account-type">{account.type} · {account.stores.toLocaleString()} tiendas</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span className={`health-badge health-${health}`}>
            <span className={`health-dot dot-${health}`} />{getHealthLabel(health)}
          </span>
        </div>
      </div>
      {critSkus.length > 0 && (
        <div className="alert alert-red" style={{ marginBottom: 12, padding: "8px 12px" }}>
          <span>⚠</span><span>Riesgo quiebre: <strong>{critSkus.join(", ")}</strong></span>
        </div>
      )}
      <div className="account-stats">
        <div>
          <div className="account-stat-label">Sell-Out Sem.</div>
          <div className="account-stat-value">{formatMXN(lastWeekSO, true)}</div>
        </div>
        <div>
          <div className="account-stat-label">Cobertura prom.</div>
          <div className="account-stat-value">{avgCov.toFixed(0)} dias</div>
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="metric-label">Ejecucion fondos</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: fundExec < 50 ? "var(--red)" : fundExec < 70 ? "var(--amber)" : "var(--green-dark)" }}>{fundExec.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(fundExec, 100)}%`, background: fundExec < 50 ? "var(--red)" : fundExec < 70 ? "var(--amber)" : "var(--green)" }} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--gray-400)" }}>KAM: {account.kam}</span>
        {account.listed && <span className="chip chip-blue">BMV</span>}
      </div>
    </div>
  )
}

export default function Dashboard({ onSelectAccount }) {
  const summary = useMemo(() => {
    const total_so = accounts.reduce((sum, acc) => sum + getLastWeekSellout(sellout, acc.id), 0)
    const atRisk = accounts.filter(a => getAccountHealth(a.id, inventory, funds) === "red").length
    const attention = accounts.filter(a => getAccountHealth(a.id, inventory, funds) === "amber").length
    return { total_so, atRisk, attention }
  }, [])
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Radar de Cuentas Clave</h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)" }}>Semana 47 · {accounts.length} cuentas activas · Selecciona una cuenta para el analisis completo</p>
      </div>
      <div className="metric-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Sell-Out total sem. 47</div>
          <div className="metric-value">{formatMXN(summary.total_so, true)}</div>
          <div className="metric-sub">Suma todas las cuentas</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Cuentas en riesgo</div>
          <div className="metric-value" style={{ color: summary.atRisk > 0 ? "var(--red)" : "var(--green)" }}>{summary.atRisk}</div>
          <div className="metric-sub">Quiebre inminente o fondos menos de 50%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Requieren atencion</div>
          <div className="metric-value" style={{ color: summary.attention > 0 ? "var(--amber)" : "var(--green)" }}>{summary.attention}</div>
          <div className="metric-sub">Cobertura o fondos en zona amarilla</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Objetivo anual total</div>
          <div className="metric-value">{formatMXN(accounts.reduce((s, a) => s + a.annual_target_mxn, 0), true)}</div>
          <div className="metric-sub">5 cuentas KAM</div>
        </div>
      </div>
      <div className="accounts-grid">
        {accounts.map(account => <AccountCard key={account.id} account={account} onSelect={onSelectAccount} />)}
      </div>
    </div>
  )
}
