import { useState } from "react"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import brandMap from "../data/brand_map.json"
import tradeComunicados from "../data/trade_comunicados.json"
import { formatMXN } from "../utils/helpers"

const SYSTEM_PRESENTACION = `Eres un experto en ventas conceptuales para cuentas clave de consumo masivo en Mexico. 
Generas presentaciones ejecutivas de alto nivel para que los KAMs de Genomma Lab lleven a sus clientes.
El formato siempre es venta conceptual con 5 secciones: Contexto, La Idea, Como Funciona, Beneficios para el Cliente, Cierre Paso Facil.
Usas datos reales de la cuenta, lenguaje ejecutivo, cifras cuantificadas y argumentos que conectan con los objetivos del retailer.
Respondes en espanol, tono consultivo y estrategico. Sin disclaimers.`

export default function PresentacionCliente({ accountId, onBack }) {
  const account = accounts.find(a => a.id === accountId)
  const [loading, setLoading] = useState(false)
  const [presentacion, setPresentacion] = useState(null)
  const [selectedComunicado, setSelectedComunicado] = useState(null)
  const [mode, setMode] = useState("cuenta")
  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

  const marcas = brandMap[accountId] || []
  const oportunidades = marcas.filter(m => m.categoria === "revertir" || m.categoria === "capitalizar")

  async function generarPresentacion() {
    setLoading(true)
    setPresentacion(null)
    const so = sellout[accountId]
    const fund = funds[accountId]
    const contexto = {
      cuenta: account.name,
      tipo: account.type,
      tiendas: account.stores,
      kam: account.kam,
      buyer: account.buyer,
      oportunidades_marcas: oportunidades,
      fondos_ejecutados_pct: fund.execution_pct,
      fondos_disponibles_mxn: fund.annual_committed_mxn - fund.executed_ytd_mxn,
      comunicado: selectedComunicado ? tradeComunicados.find(c => c.id === selectedComunicado) : null,
    }

    const prompt = `Genera una presentacion de venta conceptual para ${account.name}.

DATOS DE LA CUENTA:
${JSON.stringify(contexto, null, 2)}

Genera la presentacion en este formato JSON exacto:
{
  "titulo": "titulo ejecutivo de la presentacion",
  "subtitulo": "subtitulo con contexto de la cuenta",
  "secciones": [
    {
      "numero": 1,
      "nombre": "Contexto",
      "titulo_slide": "titulo del slide",
      "contenido": "desarrollo del contenido con datos especificos de la cuenta",
      "dato_clave": "cifra o dato mas impactante de esta seccion"
    },
    {
      "numero": 2,
      "nombre": "La Idea",
      "titulo_slide": "...",
      "contenido": "...",
      "dato_clave": "..."
    },
    {
      "numero": 3,
      "nombre": "Como Funciona",
      "titulo_slide": "...",
      "contenido": "...",
      "dato_clave": "..."
    },
    {
      "numero": 4,
      "nombre": "Beneficios para el Cliente",
      "titulo_slide": "...",
      "contenido": "...",
      "dato_clave": "..."
    },
    {
      "numero": 5,
      "nombre": "Cierre - Paso Facil",
      "titulo_slide": "...",
      "contenido": "...",
      "dato_clave": "..."
    }
  ],
  "siguiente_paso": "accion concreta que debe tomar el KAM al terminar la reunion"
}`

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 2000, system: SYSTEM_PRESENTACION, messages: [{ role: "user", content: prompt }] })
      })
      const data = await res.json()
      const raw = data.content[0].text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      setPresentacion(JSON.parse(raw))
    } catch (e) {
      alert("Error al generar la presentacion. Verifica tu API key.")
    } finally { setLoading(false) }
  }

  const colorSeccion = [
    "var(--primary)", "var(--cyan)", "var(--success)", "var(--warning)", "var(--critical)"
  ]

  return (
    <div>
      <div className="breadcrumb">
        <a onClick={onBack}>Dashboard</a><span>›</span><a onClick={onBack}>{account.name}</a><span>›</span><span>Presentacion al Cliente</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Presentacion al Cliente</h1>
          <p style={{ fontSize: 13, color: "var(--silver)" }}>Venta conceptual para {account.name} · KAM: {account.kam}</p>
        </div>
      </div>

      {!presentacion && !loading && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Configurar presentacion</div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--silver)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo de presentacion</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className={`btn ${mode === "cuenta" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("cuenta")} style={{ fontSize: 12 }}>
                Oportunidades de la cuenta
              </button>
              <button className={`btn ${mode === "trade" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("trade")} style={{ fontSize: 12 }}>
                Comunicado de Trade
              </button>
            </div>
          </div>

          {mode === "trade" && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--silver)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Selecciona el comunicado</div>
              {tradeComunicados.map(com => (
                <div key={com.id} onClick={() => setSelectedComunicado(selectedComunicado === com.id ? null : com.id)} style={{ background: selectedComunicado === com.id ? "var(--primary-wash)" : "var(--pearl)", border: `1px solid ${selectedComunicado === com.id ? "var(--primary)" : "#E2E8F0"}`, borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--obsidian)", marginBottom: 4 }}>{com.titulo}</div>
                  <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 4 }}>{com.resumen}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className="chip chip-cyan">{com.tipo}</span>
                    <span style={{ fontSize: 11, color: "var(--silver)" }}>{com.periodo}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>{formatMXN(com.inversion_total_mxn, true)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "var(--silver)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Oportunidades detectadas para {account.name}</div>
            {oportunidades.map(m => (
              <div key={m.marca} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0F2F5" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--obsidian)" }}>{m.marca}</span>
                  <span style={{ fontSize: 12, color: "var(--silver)", marginLeft: 8 }}>{m.razon}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.categoria === "revertir" ? "var(--critical)" : "var(--success)", fontFamily: "var(--font-mono)" }}>
                  {m.sell_out_trend > 0 ? "+" : ""}{m.sell_out_trend.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={generarPresentacion} disabled={!hasApiKey || (mode === "trade" && !selectedComunicado)} style={{ fontSize: 14, padding: "11px 28px" }}>
            Generar presentacion con IA
          </button>
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="loading-pulse">
            <div className="pulse-dots"><div className="pulse-dot" /><div className="pulse-dot" /><div className="pulse-dot" /></div>
            <span>Generando presentacion de venta conceptual para {account.name}...</span>
            <span style={{ fontSize: 11, color: "var(--silver)" }}>Analizando oportunidades, cruzando datos y estructurando argumentos</span>
          </div>
        </div>
      )}

      {presentacion && !loading && (
        <div>
          <div className="card" style={{ marginBottom: 16, background: "var(--obsidian)", border: "none" }}>
            <div style={{ fontSize: 11, color: "var(--cyan)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Presentacion generada · {account.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--white)", marginBottom: 4 }}>{presentacion.titulo}</div>
            <div style={{ fontSize: 14, color: "var(--silver)" }}>{presentacion.subtitulo}</div>
          </div>

          {presentacion.secciones?.map((sec, i) => (
            <div key={i} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${colorSeccion[i]}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: colorSeccion[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white", flexShrink: 0 }}>{sec.numero}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{sec.nombre}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)" }}>{sec.titulo_slide}</div>
                </div>
                <div style={{ marginLeft: "auto", background: colorSeccion[i] + "20", borderRadius: "var(--radius-md)", padding: "6px 12px", textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: colorSeccion[i], fontFamily: "var(--font-mono)" }}>{sec.dato_clave}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sec.contenido}</p>
            </div>
          ))}

          <div className="card" style={{ background: "var(--success-light)", border: "1px solid var(--success)", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Siguiente paso</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>{presentacion.siguiente_paso}</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setPresentacion(null); setSelectedComunicado(null) }} style={{ fontSize: 12 }}>
              ← Nueva presentacion
            </button>
            <button className="btn btn-primary" onClick={generarPresentacion} style={{ fontSize: 12 }}>
              ↻ Regenerar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
