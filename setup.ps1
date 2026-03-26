$base = "C:\Users\mvazqueze\Documents\genomma-kam-agent"

Set-Content "$base\src\pages\MarketSignals.jsx" @'
import { useState } from "react"
import accounts from "../data/accounts.json"
import marketSignals from "../data/market_signals.json"
import { analyzeMarketSignal } from "../utils/agentService"

function SignalCard({ account, signal, onAnalyze, aiAnalysis, analyzing }) {
  const isUp = signal.change_pct >= 0
  return (
    <div className="ticker-card">
      <div className="ticker-header">
        <div className="account-icon" style={{ background: account.color, width: 36, height: 36, fontSize: 11, borderRadius: 8 }}>{account.logo_initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{account.name}</div>
          <span className="ticker-symbol">{signal.ticker}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="ticker-price">${signal.price_mxn.toFixed(2)}</span>
          <span className={`ticker-change ${isUp ? "delta-up" : "delta-down"}`}>{isUp ? "▲" : "▼"} {Math.abs(signal.change_pct).toFixed(2)}%</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="metric-label">Revenue</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>${signal.last_earnings.revenue_bn_mxn}B</div>
          <div className="delta-up" style={{ fontSize: 11 }}>+{signal.last_earnings.revenue_growth_yoy}% YoY</div>
        </div>
        <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="metric-label">EBITDA</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{signal.last_earnings.ebitda_margin_pct}%</div>
          <div className="metric-sub">margen</div>
        </div>
        <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="metric-label">SSS Growth</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{signal.last_earnings.same_store_sales_growth}%</div>
          <div className="metric-sub">mismas tiendas</div>
        </div>
        <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "8px 10px" }}>
          <div className="metric-label">Cap. Mercado</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>${signal.market_cap_bn}B</div>
          <div className="metric-sub">MXN</div>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Highlights {signal.last_earnings.quarter}</div>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {signal.last_earnings.key_highlights.map((h, i) => (
            <li key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--gray-600)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>›</span>{h}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ background: "var(--blue-light)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Implicacion para Genomma</div>
        <p style={{ fontSize: 12, color: "var(--blue)", lineHeight: 1.55, margin: 0 }}>{signal.strategic_implication}</p>
      </div>
      {aiAnalysis && (
        <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "12px 14px", marginBottom: 14, borderLeft: "3px solid var(--green)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--green-dark)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Analisis del Agente IA</div>
          <p style={{ fontSize: 12, color: "var(--gray-600)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{aiAnalysis}</p>
        </div>
      )}
      <button className="btn btn-secondary" onClick={() => onAnalyze(account.id)} disabled={analyzing === account.id} style={{ fontSize: 12, width: "100%", justifyContent: "center" }}>
        {analyzing === account.id ? "Analizando…" : "🤖 Analizar impacto con IA"}
      </button>
    </div>
  )
}

export default function MarketSignals() {
  const listedAccounts = accounts.filter(a => a.listed)
  const [analyses, setAnalyses] = useState({})
  const [analyzing, setAnalyzing] = useState(null)

  async function handleAnalyze(accountId) {
    setAnalyzing(accountId)
    const account = accounts.find(a => a.id === accountId)
    try {
      const result = await analyzeMarketSignal(account, marketSignals)
      setAnalyses(prev => ({ ...prev, [accountId]: result }))
    } catch (e) {
      setAnalyses(prev => ({ ...prev, [accountId]: "Error al analizar. Verifica tu API key." }))
    } finally { setAnalyzing(null) }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Senales Bursatiles</h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)" }}>Inteligencia financiera publica · {listedAccounts.length} cuentas que cotizan en BMV</p>
      </div>
      <div className="alert alert-amber" style={{ marginBottom: 20 }}>
        <span>📊</span>
        <span style={{ fontSize: 12 }}>Datos simulados con estructura real. En produccion se conectan automaticamente a BMV y reportes trimestrales.</span>
      </div>
      {listedAccounts.map(account => (
        <SignalCard key={account.id} account={account} signal={marketSignals[account.id]} onAnalyze={handleAnalyze} aiAnalysis={analyses[account.id]} analyzing={analyzing} />
      ))}
    </div>
  )
}
'@

Write-Host "MarketSignals OK" -ForegroundColor Green