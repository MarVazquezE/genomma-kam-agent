import { useState, useRef, useEffect } from "react"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import marketSignals from "../data/market_signals.json"
import { formatMXN } from "../utils/helpers"
import { generateWeeklyActions, chatWithAgent } from "../utils/agentService"

const typeIcon = { inventory: "📦", funds: "💰", growth: "📈", risk: "⚠️", financial: "📊" }
const urgencyColor = { alta: "chip-red", media: "chip-amber", baja: "chip-green" }
const ownerStyle = {
  Marco: { bg: "#E6F1FB", color: "#185FA5", label: "→ Marco" },
  Rodrigo: { bg: "#EEEDFE", color: "#534AB7", label: "→ Rodrigo" }
}

export default function AgentPage({ accountId, onBack }) {
  const account = accounts.find(a => a.id === accountId)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)
  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [chatHistory])

  async function handleGenerate() {
    setLoading(true); setError(null)
    try {
      const data = await generateWeeklyActions(account, sellout, inventory, funds, marketSignals)
      setResult(data)
    } catch (e) {
      setError(`Error: ${e.message}. Verifica tu API key en el archivo .env`)
    } finally { setLoading(false) }
  }

  async function handleChat() {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim(); setChatInput("")
    setChatHistory(h => [...h, { role: "user", content: msg }])
    setChatLoading(true)
    try {
      const reply = await chatWithAgent(account, sellout, inventory, funds, msg, chatHistory)
      setChatHistory(h => [...h, { role: "assistant", content: reply }])
    } catch (e) {
      setChatHistory(h => [...h, { role: "assistant", content: "Error al conectar. Verifica la API key." }])
    } finally { setChatLoading(false) }
  }

  return (
    <div>
      <div className="breadcrumb">
        <a onClick={onBack}>Dashboard</a><span>›</span><a onClick={onBack}>{account.name}</a><span>›</span><span>Agente IA</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Agente KAM · {account.name}</h1>
          <p style={{ fontSize: 13, color: "var(--gray-400)" }}>Analisis semanal inteligente · Sem. 47 · KAM: {account.kam}</p>
        </div>
        {!hasApiKey && (
          <div className="alert alert-amber" style={{ marginBottom: 0, maxWidth: 340 }}>
            <span>⚠</span><span>Configura VITE_ANTHROPIC_API_KEY en tu archivo .env</span>
          </div>
        )}
      </div>

      {!result && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Listo para analizar</h2>
          <p style={{ fontSize: 13, color: "var(--gray-400)", marginBottom: 24 }}>El agente analizara sell-out, inventario, fondos y senales de mercado de {account.name}.</p>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!hasApiKey} style={{ fontSize: 14, padding: "11px 28px" }}>
            Generar analisis semanal
          </button>
          {error && <div className="alert alert-red" style={{ marginTop: 16, textAlign: "left" }}><span>✕</span><span>{error}</span></div>}
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="loading-pulse">
            <div className="pulse-dots"><div className="pulse-dot" /><div className="pulse-dot" /><div className="pulse-dot" /></div>
            <span>El agente esta analizando {account.name}…</span>
            <span style={{ fontSize: 11, color: "var(--gray-400)" }}>Procesando sell-out, inventario, fondos y senales de mercado</span>
          </div>
        </div>
      )}

      {result && !loading && (
        <>
          <div className="alert alert-green" style={{ marginBottom: 16 }}><span>●</span><span style={{ fontSize: 13 }}>{result.resumen_ejecutivo}</span></div>
          <div className="section-header">
            <div><div className="section-title">Top 3 Acciones · Semana 47</div><div className="section-sub">Ordenadas por prioridad e impacto</div></div>
            <button className="btn btn-secondary" onClick={handleGenerate} style={{ fontSize: 12 }}>↻ Regenerar</button>
          </div>
          {result.actions?.map(action => {
            const owner = ownerStyle[action.owner] || ownerStyle.Marco
            return (
              <div key={action.priority} className={`action-item priority-${action.priority}`}>
                <div className="action-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{typeIcon[action.type] || "●"}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-400)", minWidth: 20 }}>#{action.priority}</span>
                    <span className="action-title">{action.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <span className={`chip ${urgencyColor[action.urgency]}`}>{action.urgency}</span>
                    <span className="chip" style={{ background: owner.bg, color: owner.color }}>{owner.label}</span>
                  </div>
                </div>
                <div className="action-desc">{action.description}</div>
                <div className="action-impact">⊕ {action.impact}</div>
              </div>
            )
          })}
          <div className="divider" />
          {result.optimal_order && (
            <div style={{ marginBottom: 20 }}>
              <div className="section-header">
                <div><div className="section-title">Orden de Compra Optima Sugerida</div><div className="section-sub">{result.optimal_order.justification}</div></div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green-dark)" }}>{formatMXN(result.optimal_order.total_value_mxn, true)}</div>
                  <div style={{ fontSize: 11, color: "var(--gray-400)" }}>valor total OC</div>
                </div>
              </div>
              <div className="card card-sm">
                <table className="data-table">
                  <thead><tr><th>SKU</th><th style={{ textAlign: "right" }}>Cob. actual</th><th style={{ textAlign: "right" }}>Unidades</th><th style={{ textAlign: "right" }}>Valor MXN</th><th style={{ textAlign: "center" }}>Prioridad</th><th>Justificacion</th></tr></thead>
                  <tbody>
                    {result.optimal_order.sku_orders?.filter(s => s.suggested_units > 0).map((sku, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{sku.sku}</td>
                        <td style={{ textAlign: "right" }}>{sku.current_coverage_days > 0 ? `${sku.current_coverage_days} dias` : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sku.suggested_units.toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{formatMXN(sku.suggested_value_mxn, true)}</td>
                        <td style={{ textAlign: "center" }}><span className={`chip ${sku.priority === "urgente" ? "chip-red" : sku.priority === "programada" ? "chip-amber" : "chip-green"}`}>{sku.priority}</span></td>
                        <td style={{ fontSize: 12, color: "var(--gray-600)" }}>{sku.justification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--gray-400)" }}>Ventana de entrega: {result.optimal_order.delivery_window}</div>
              </div>
            </div>
          )}
          <div className="divider" />
        </>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, background: hasApiKey ? "var(--green)" : "var(--gray-200)", borderRadius: "50%" }} />
          <span className="section-title">Chat con el Agente</span>
          <span className="section-sub" style={{ marginLeft: "auto" }}>Pregunta lo que necesites sobre {account.name}</span>
        </div>
        {chatHistory.length === 0 && (
          <div style={{ padding: "16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["¿Que riesgo hay si Walmart reduce 15% su inventario de Alliviax?", "¿Cuanto podriamos crecer en Suerox si ejecutamos la promo pendiente?", "¿Como preparo la reunion con el comprador esta semana?"].map((q, i) => (
              <button key={i} className="btn btn-secondary" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => setChatInput(q)}>{q}</button>
            ))}
          </div>
        )}
        {chatHistory.length > 0 && (
          <div className="chat-area">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role === "user" ? "user" : "agent"}`} style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
            ))}
            {chatLoading && <div className="chat-msg agent"><div className="pulse-dots"><div className="pulse-dot" style={{ width: 6, height: 6 }} /><div className="pulse-dot" style={{ width: 6, height: 6 }} /><div className="pulse-dot" style={{ width: 6, height: 6 }} /></div></div>}
            <div ref={chatEndRef} />
          </div>
        )}
        <div className="chat-input-area">
          <input className="chat-input" placeholder={hasApiKey ? `Pregunta sobre ${account.name}...` : "Configura VITE_ANTHROPIC_API_KEY para activar el chat"} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()} disabled={!hasApiKey || chatLoading} />
          <button className="btn btn-primary" onClick={handleChat} disabled={!chatInput.trim() || !hasApiKey || chatLoading} style={{ padding: "9px 16px" }}>Enviar</button>
        </div>
      </div>
    </div>
  )
}
