import { useMemo, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart } from "recharts"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import sellin from "../data/sellin.json"
import brandMap from "../data/brand_map.json"
import executionScorecard from "../data/execution_scorecard.json"
import marketShare from "../data/market_share.json"
import tiendaPerfecta from "../data/tienda_perfecta.json"
import kbd from "../data/kbd.json"
import brutoNeto from "../data/bruto_neto.json"
import { formatMXN, getAccountHealth, getHealthLabel, getLastWeekSellout, getAvgCoverage, getCriticalSkus } from "../utils/helpers"

const SKU_COLORS = ["#6366F1","#14B8A6","#F59E0B","#F43F5E","#8B5CF6","#06B6D4","#F97316","#EC4899","#10B981","#3B82F6","#EF4444","#84CC16"]

function KPICard({ label, value, target, vsLY, pct, onClick, sub }) {
  const isGood = pct >= 100
  const lyGood = vsLY >= 0
  return (
    <div className="metric-card" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.borderColor = "var(--cyan)" }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.borderColor = "#E2E8F0" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="metric-label">{label}</div>
        {onClick && <span style={{ fontSize: 10, color: "var(--cyan)", fontWeight: 700 }}>Ver detalle</span>}
      </div>
      <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--silver)" }}>{sub || ("Obj: " + target)}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: isGood ? "var(--success)" : "var(--critical)" }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="progress-bar" style={{ marginTop: 4 }}>
        <div className="progress-fill" style={{ width: Math.min(pct, 100) + "%", background: isGood ? "var(--success)" : "var(--critical)" }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: lyGood ? "var(--success)" : "var(--critical)" }}>
        {lyGood ? "+" : ""}{vsLY.toFixed(1)}% vs LY
      </div>
    </div>
  )
}

function AlertCard({ label, value, sub, color, onClick }) {
  const c = color || "var(--critical)"
  return (
    <div className="metric-card" onClick={onClick} style={{ borderLeft: "3px solid " + c, cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.boxShadow = "0 0 0 2px " + c + "30" }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.boxShadow = "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="metric-label">{label}</div>
        {onClick && <span style={{ fontSize: 10, color: c, fontWeight: 700 }}>Ver detalle</span>}
      </div>
      <div className="metric-value" style={{ color: c, fontFamily: "var(--font-mono)", fontSize: 18 }}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  )
}

function TPScoreCard({ accountId, onClick }) {
  const tp = tiendaPerfecta[accountId]
  if (!tp) return null
  const color = tp.score_general_pct >= 80 ? "var(--success)" : tp.score_general_pct >= 65 ? "var(--warning)" : "var(--critical)"
  return (
    <div className="metric-card" onClick={onClick} style={{ borderLeft: "3px solid " + color, cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.boxShadow = "0 0 0 2px " + color + "30" }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.boxShadow = "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="metric-label">Tienda Perfecta</div>
        {onClick && <span style={{ fontSize: 10, color, fontWeight: 700 }}>Ver detalle</span>}
      </div>
      <div className="metric-value" style={{ color, fontFamily: "var(--font-mono)", fontSize: 18 }}>{tp.score_general_pct.toFixed(0)}%</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--silver)" }}>Obj: {tp.objetivo_pct}%</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{tp.gap_pts.toFixed(1)} pts gap</span>
      </div>
      <div className="progress-bar" style={{ marginTop: 4 }}>
        <div className="progress-fill" style={{ width: Math.min((tp.score_general_pct / tp.objetivo_pct) * 100, 100) + "%", background: color }} />
      </div>
    </div>
  )
}

function AgendaKAM({ accountId }) {
  const tp = tiendaPerfecta[accountId]
  const ms = marketShare[accountId]
  const brandas = brandMap[accountId] || []
  const scorecard = executionScorecard[accountId] || []
  const ejecutar = []
  const negociar = []
  if (tp && tp.score_general_pct < 70) {
    tp.indicadores.filter(i => i.status === "off_track" && i.marcas_criticas.length > 0).forEach(ind => {
      ejecutar.push({ tipo: "Tienda Perfecta", accion: ind.nombre + " - Critico: " + ind.marcas_criticas.join(", "), impacto: "TP Score: " + tp.score_general_pct.toFixed(0) + "% vs obj " + tp.objetivo_pct + "%" })
    })
  }
  if (ms) {
    Object.entries(ms.categorias).forEach(([cat, data]) => {
      data.marcas.filter(m => !m.es_competidor && m.tendencia === "baja").forEach(m => {
        negociar.push({ tipo: "Market Share", accion: "Defender SOM " + m.marca + " en " + cat + " - Actual " + m.som_pct + "% vs " + m.competidor + " " + m.competidor_som_pct + "%", impacto: "Gap: " + m.gap_liderazgo_pts.toFixed(1) + " pts" })
      })
    })
  }
  scorecard.filter(i => i.estado === "off_track").forEach(item => {
    negociar.push({ tipo: "Ejecucion", accion: item.iniciativa + " - " + item.accion, impacto: item.venta_perdida_mxn > 0 ? "Venta perdida: " + formatMXN(item.venta_perdida_mxn, true) + " MXN" : "Pendiente" })
  })
  brandas.filter(m => m.categoria === "revertir").slice(0, 2).forEach(m => {
    ejecutar.push({ tipo: "Sell-Out Neto", accion: "Plan recuperacion " + m.marca + " - Caida " + m.sell_out_trend.toFixed(1) + "% YoY", impacto: "Gap YTD: " + formatMXN(Math.abs(m.gap_ytd), true) + " MXN" })
  })
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Agenda KAM Esta Semana</div>
      <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 12 }}>Prioridades basadas en sell-out neto, share, Tienda Perfecta y KBDs</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Ejecutar esta semana</div>
          {ejecutar.slice(0, 4).map((a, i) => (
            <div key={i} style={{ background: "var(--critical-light)", borderRadius: "var(--radius-md)", padding: "8px 10px", marginBottom: 6, borderLeft: "3px solid var(--critical)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--critical)", textTransform: "uppercase", marginBottom: 2 }}>{a.tipo}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--obsidian)", marginBottom: 2 }}>{a.accion}</div>
              <div style={{ fontSize: 10, color: "var(--silver)" }}>{a.impacto}</div>
            </div>
          ))}
          {ejecutar.length === 0 && <div style={{ fontSize: 12, color: "var(--success)" }}>Sin acciones urgentes</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Negociar con el cliente</div>
          {negociar.slice(0, 4).map((a, i) => (
            <div key={i} style={{ background: "var(--warning-light)", borderRadius: "var(--radius-md)", padding: "8px 10px", marginBottom: 6, borderLeft: "3px solid var(--warning)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", textTransform: "uppercase", marginBottom: 2 }}>{a.tipo}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--obsidian)", marginBottom: 2 }}>{a.accion}</div>
              <div style={{ fontSize: 10, color: "var(--silver)" }}>{a.impacto}</div>
            </div>
          ))}
          {negociar.length === 0 && <div style={{ fontSize: 12, color: "var(--success)" }}>Sin negociaciones urgentes</div>}
        </div>
      </div>
    </div>
  )
}

function TPDetail({ accountId, onClose }) {
  const tp = tiendaPerfecta[accountId]
  if (!tp) return null
  const color = tp.score_general_pct >= 80 ? "var(--success)" : tp.score_general_pct >= 65 ? "var(--warning)" : "var(--critical)"
  return (
    <div style={{ background: "var(--white)", border: "1px solid #E2E8F0", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Tienda Perfecta - Detalle por Indicador y Marca</div>
          <div style={{ fontSize: 12, color: "var(--silver)", marginTop: 2 }}>Score general: <strong style={{ color }}>{tp.score_general_pct.toFixed(0)}%</strong> vs objetivo {tp.objetivo_pct}%</div>
        </div>
        {onClose && <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: "6px 14px" }}>Cerrar</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Indicadores de Ejecucion</div>
          {tp.indicadores.map((ind, i) => {
            const c = ind.status === "off_track" ? "var(--critical)" : ind.status === "at_risk" ? "var(--warning)" : "var(--success)"
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{ind.nombre}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: "var(--font-mono)" }}>{ind.resultado_pct.toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, background: "#F0F2F5", borderRadius: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, width: Math.min((ind.resultado_pct / ind.objetivo_pct) * 100, 100) + "%", background: c }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: "var(--silver)" }}>Obj: {ind.objetivo_pct}%</span>
                  {ind.marcas_criticas.length > 0 && <span style={{ fontSize: 9, color: c }}>Critico: {ind.marcas_criticas.join(", ")}</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Score por Marca</div>
          <table className="data-table">
            <thead><tr><th>Marca</th><th style={{ textAlign: "right" }}>Dispo</th><th style={{ textAlign: "right" }}>Precio</th><th style={{ textAlign: "right" }}>Exhib</th><th style={{ textAlign: "right" }}>TP Score</th></tr></thead>
            <tbody>
              {tp.marcas_detalle.map((m, i) => {
                const c = m.tp_score_pct >= 80 ? "var(--success)" : m.tp_score_pct >= 65 ? "var(--warning)" : "var(--critical)"
                return (<tr key={i}><td style={{ fontWeight: 700 }}>{m.marca}</td><td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--font-mono)" }}>{m.dispo_pct.toFixed(0)}%</td><td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--font-mono)" }}>{m.precio_ok_pct.toFixed(0)}%</td><td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--font-mono)" }}>{m.exhibicion_pct.toFixed(0)}%</td><td style={{ textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: "var(--font-mono)" }}>{m.tp_score_pct.toFixed(0)}%</span></td></tr>)
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MarketShareDetail({ accountId, onClose }) {
  const ms = marketShare[accountId]
  if (!ms) return null
  return (
    <div style={{ background: "var(--white)", border: "1px solid #E2E8F0", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Market Share por Categoria vs Competencia</div>
        {onClose && <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: "6px 14px" }}>Cerrar</button>}
      </div>
      {Object.entries(ms.categorias).map(([cat, data]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{cat}</span>
            <span style={{ fontSize: 11, color: "var(--silver)" }}>Total: {formatMXN(data.categoria_total_mxn_semana, true)} MXN/sem</span>
          </div>
          {data.marcas.map((m, i) => {
            const isG = !m.es_competidor
            const c = isG ? (m.tendencia === "alza" ? "var(--success)" : m.tendencia === "baja" ? "var(--critical)" : "var(--silver)") : "#CBD5E1"
            return (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: isG ? c : "#CBD5E1", display: "inline-block" }} />
                    <span style={{ fontSize: 11, fontWeight: isG ? 700 : 400, color: isG ? "var(--obsidian)" : "var(--silver)" }}>{m.marca}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: isG ? 800 : 400, color: isG ? c : "var(--silver)", fontFamily: "var(--font-mono)" }}>{m.som_pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: "#F0F2F5", borderRadius: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, width: Math.min(m.som_pct, 100) + "%", background: isG ? c : "#CBD5E1" }} />
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function KBDDetail({ accountId, onClose }) {
  const marcas = (brandMap[accountId] || []).map(m => m.marca)
  const kbdData = marcas.map(marca => ({ marca, data: kbd[marca] })).filter(x => x.data)
  return (
    <div style={{ background: "var(--white)", border: "1px solid #E2E8F0", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Key Business Drivers - Cumplimiento por Marca</div>
        {onClose && <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: "6px 14px" }}>Cerrar</button>}
      </div>
      {kbdData.map(({ marca, data }) => (
        <div key={marca} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottom: "2px solid #F0F2F5" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{marca}</span>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: 11, color: "var(--silver)" }}>Competidor: <strong>{data.competidor_principal}</strong></span>
            </div>
          </div>
          {data.kbds.map((k, i) => {
            const c = k.status === "off_track" ? "var(--critical)" : k.status === "at_risk" ? "var(--warning)" : "var(--success)"
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #F0F2F5" }}>
                <div style={{ width: 48, flexShrink: 0, textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: "var(--font-mono)" }}>{k.cumplimiento_pct}%</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--obsidian)", marginBottom: 2 }}><strong>[{k.area}]</strong> {k.descripcion.substring(0, 90)}</div>
                  <div style={{ fontSize: 10, color: "var(--silver)" }}>Impacto: {k.impacto}</div>
                </div>
                <span style={{ fontSize: 9, background: k.status === "off_track" ? "var(--critical-light)" : k.status === "at_risk" ? "var(--warning-light)" : "var(--success-light)", color: c, padding: "2px 8px", borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>
                  {k.status === "off_track" ? "OFF TRACK" : k.status === "at_risk" ? "AT RISK" : "OK"}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// NUEVO MODULO: BRUTO vs NETO por Cliente y Marca
// ============================================================
function BrutoNetoModule({ accountId }) {
  const data = brutoNeto[accountId]
  const si = sellin[accountId]
  if (!data) return <div style={{ padding: 20, color: "var(--silver)" }}>Sin datos bruto/neto para esta cuenta.</div>
  const acc = accounts.find(a => a.id === accountId)
  const tradeObjPct = data.trade_obj_pct || 0
  const tradeRealPct = data.pct_trade_ytd || 0
  const desviacion = data.trade_desviacion_pts || 0
  const alertaNivel = data.alerta_nivel
  const siObjBruto = si?.objetivo_bruto_anual || 0
  const siObjNeto = si?.objetivo_neto_anual || 0
  return (
    <div>
      {data.alerta_trade && (
        <div className={"alert " + (alertaNivel === "critica" ? "alert-red" : "alert-amber")} style={{ marginBottom: 12 }}>
          <span>!</span>
          <div>
            <strong>Alerta de Trade: {data.alerta_trade}</strong>
            <div style={{ fontSize: 11, marginTop: 2 }}>Exceso de inversion comercial vs presupuesto G60. Revisar descuentos y bonificaciones.</div>
          </div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Analisis Bruto vs Neto - {acc?.name}</div>
        <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 16 }}>Sell-Out W12/2026 · Objetivo G60 vs Real · Delta = Inversion comercial</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          <div className="metric-card" style={{ borderLeft: "3px solid var(--info)" }}>
            <div className="metric-label">Sell-Out Bruto W12</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{formatMXN(data.total_bruto_w12, true)}</div>
            <div className="metric-sub">Obj Bruto Anual: {formatMXN(siObjBruto, true)}</div>
          </div>
          <div className="metric-card" style={{ borderLeft: "3px solid var(--primary)" }}>
            <div className="metric-label">Sell-Out Neto W12</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{formatMXN(data.total_neto_w12, true)}</div>
            <div className="metric-sub">Obj Neto Anual: {formatMXN(siObjNeto, true)}</div>
          </div>
          <div className="metric-card" style={{ borderLeft: "3px solid var(--warning)" }}>
            <div className="metric-label">% Trade Real YTD</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: desviacion > 3 ? "var(--critical)" : "var(--warning)" }}>{tradeRealPct}%</div>
            <div className="metric-sub">Presupuesto G60: {tradeObjPct}%</div>
          </div>
          <div className="metric-card" style={{ borderLeft: desviacion > 3 ? "3px solid var(--critical)" : "3px solid var(--success)" }}>
            <div className="metric-label">Desviacion vs Presupuesto</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: desviacion > 3 ? "var(--critical)" : desviacion > 0 ? "var(--warning)" : "var(--success)" }}>{desviacion > 0 ? "+" : ""}{desviacion} pts</div>
            <div className="metric-sub">Real 2025: {data.trade_real25_pct || 0}%</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--silver)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Trade Presupuesto G60</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--primary)" }}>{tradeObjPct}%</div>
          </div>
          <div style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--silver)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Trade Real YTD 2026</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)", color: desviacion > 3 ? "var(--critical)" : "var(--obsidian)" }}>{tradeRealPct}%</div>
          </div>
          <div style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--silver)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Trade Real 2025</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--silver)" }}>{data.trade_real25_pct || 0}%</div>
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Detalle por Marca - Bruto vs Neto vs Objetivo G60</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th style={{ textAlign: "right" }}>Bruto W12</th>
              <th style={{ textAlign: "right" }}>Neto W12</th>
              <th style={{ textAlign: "right" }}>% Trade Real</th>
              <th style={{ textAlign: "right" }}>% Trade G60</th>
              <th style={{ textAlign: "right" }}>Desv.</th>
              <th style={{ textAlign: "right" }}>YoY Bruto</th>
              <th style={{ textAlign: "right" }}>YoY Neto</th>
              <th style={{ textAlign: "center" }}>Alerta</th>
            </tr>
          </thead>
          <tbody>
            {data.marcas.slice(0, 15).map((m, i) => {
              const desv = m.trade_desviacion || 0
              const dobleErosion = m.doble_erosion
              const tradeExcedido = m.trade_excedido
              return (
                <tr key={i} style={{ background: dobleErosion ? "#FEF2F2" : tradeExcedido ? "#FFFBEB" : "transparent" }}>
                  <td style={{ fontWeight: 700 }}>{m.marca}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatMXN(m.bruto_w12, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatMXN(m.neto_w12, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: m.pct_trade_ytd > 25 ? "var(--critical)" : "var(--silver)" }}>{m.pct_trade_ytd}%</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)" }}>{m.trade_obj_pct || 0}%</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: desv > 3 ? "var(--critical)" : desv > 0 ? "var(--warning)" : "var(--success)" }}>{desv > 0 ? "+" : ""}{desv}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: m.yoy_bruto >= 0 ? "var(--success)" : "var(--critical)" }}>{m.yoy_bruto > 0 ? "+" : ""}{m.yoy_bruto}%</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: m.yoy_neto >= 0 ? "var(--success)" : "var(--critical)" }}>{m.yoy_neto > 0 ? "+" : ""}{m.yoy_neto}%</td>
                  <td style={{ textAlign: "center" }}>
                    {dobleErosion && <span className="chip chip-red">Doble erosion</span>}
                    {tradeExcedido && !dobleErosion && <span className="chip chip-amber">Trade excedido</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: "var(--radius-md)", fontSize: 11, color: "var(--critical)" }}>
            <strong>Doble erosion:</strong> el sell-out cae mas en neto que en bruto — se vende menos Y se da mas descuento por unidad.
          </div>
          <div style={{ padding: "8px 12px", background: "#FEF3C7", borderRadius: "var(--radius-md)", fontSize: 11, color: "#92400E" }}>
            <strong>Trade excedido:</strong> la inversion comercial real supera el presupuesto G60 por mas de 3 puntos porcentuales.
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// NUEVO MODULO: ORDEN DE COMPRA SUGERIDA (piso 21 dias)
// ============================================================
function OCModule({ accountId }) {
  const inv = inventory[accountId]
  const so = sellout[accountId]
  const acc = accounts.find(a => a.id === accountId)
  if (!inv || !so) return null
  const TARGET_DAYS = 21
  const rows = Object.entries(inv.skus).map(([marca, data]) => {
    const weeks = so.skus[marca]
    const avgWeekly = weeks ? weeks.slice(-4).reduce((s, v) => s + v, 0) / 4 : 0
    const dailySales = avgWeekly / 7
    const stockIdeal = Math.ceil(dailySales * TARGET_DAYS)
    const deficit = Math.max(0, stockIdeal - data.stock_units + (data.pending_oc || 0))
    const montoOC = deficit * data.price_mxn
    return { marca, stock: data.stock_units, coverage: data.coverage_days, dailySales: Math.round(dailySales), stockIdeal, deficit, montoOC, price: data.price_mxn, pending: data.pending_oc || 0 }
  }).sort((a, b) => b.deficit - a.deficit)

  const totalMonto = rows.reduce((s, r) => s + r.montoOC, 0)
  const totalUnits = rows.reduce((s, r) => s + r.deficit, 0)
  const urgentes = rows.filter(r => r.coverage < 10)

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Orden de Compra Sugerida - {acc?.name}</div>
        <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 16 }}>Piso minimo: {TARGET_DAYS} dias de cobertura · Basado en sell-out neto promedio L4W</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <div className="metric-card" style={{ borderLeft: "3px solid var(--primary)" }}>
            <div className="metric-label">Monto Total OC</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{formatMXN(totalMonto, true)}</div>
            <div className="metric-sub">{totalUnits.toLocaleString()} unidades</div>
          </div>
          <div className="metric-card" style={{ borderLeft: "3px solid var(--critical)" }}>
            <div className="metric-label">SKUs Urgentes</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--critical)" }}>{urgentes.length}</div>
            <div className="metric-sub">Cobertura menor a 10 dias</div>
          </div>
          <div className="metric-card" style={{ borderLeft: "3px solid var(--success)" }}>
            <div className="metric-label">SKUs en Piso</div>
            <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--success)" }}>{rows.filter(r => r.deficit === 0).length}</div>
            <div className="metric-sub">Ya tienen 21+ dias</div>
          </div>
        </div>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th style={{ textAlign: "right" }}>Stock Actual</th>
              <th style={{ textAlign: "right" }}>Cobertura</th>
              <th style={{ textAlign: "right" }}>Vta Diaria</th>
              <th style={{ textAlign: "right" }}>Stock Ideal (21d)</th>
              <th style={{ textAlign: "right" }}>OC Pedir</th>
              <th style={{ textAlign: "right" }}>Precio Unit.</th>
              <th style={{ textAlign: "right" }}>Monto OC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const covColor = r.coverage < 7 ? "var(--critical)" : r.coverage < 14 ? "var(--warning)" : "var(--success)"
              return (
                <tr key={i} style={{ background: r.coverage < 10 ? "#FEF2F2" : "transparent" }}>
                  <td style={{ fontWeight: 700 }}>{r.marca}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.stock.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: covColor }}>{r.coverage}d</span></td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.dailySales.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.stockIdeal.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: r.deficit > 0 ? "var(--critical)" : "var(--success)" }}>{r.deficit > 0 ? r.deficit.toLocaleString() : "—"}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{"$" + r.price}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{r.montoOC > 0 ? formatMXN(r.montoOC, true) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// NUEVO MODULO: VISTA MARCA → CLIENTE (comparar marca en todos los clientes)
// ============================================================
function MarcaClienteModule() {
  const allMarcas = [...new Set(accounts.flatMap(acc => Object.keys(sellout[acc.id]?.skus || {})))].sort()
  const [selectedMarca, setSelectedMarca] = useState(allMarcas[0] || "")
  const [expandedAccount, setExpandedAccount] = useState(null)
  
  // Build marca data across all accounts
  const marcaData = accounts.map(acc => {
    const so = sellout[acc.id]
    const bn = brutoNeto[acc.id]
    const weeks = so?.skus?.[selectedMarca] || []
    const w12 = weeks[weeks.length - 1] || 0
    const w11 = weeks[weeks.length - 2] || 0
    const inv_data = inventory[acc.id]?.skus?.[selectedMarca]
    const bn_marca = bn?.marcas?.find(m => m.marca === selectedMarca)
    const tp = tiendaPerfecta[acc.id]
    const tp_marca = tp?.marcas_detalle?.find(m => m.marca === selectedMarca)
    return {
      account: acc.name, accountShort: acc.name.split(" ")[0], accountId: acc.id,
      color: acc.color, logo: acc.logo_initials,
      neto_w12: bn_marca?.neto_w12 || w12, neto_ytd: bn_marca?.neto_ytd || 0,
      neto_w12_ly: bn_marca?.neto_w12 && bn_marca?.yoy_neto ? Math.round(bn_marca.neto_w12 / (1 + bn_marca.yoy_neto/100)) : 0,
      neto_ytd_ly: bn_marca?.neto_ytd && bn_marca?.yoy_neto ? Math.round(bn_marca.neto_ytd / (1 + bn_marca.yoy_neto/100)) : 0,
      bruto_w12: bn_marca?.bruto_w12 || 0, bruto_ytd: bn_marca?.bruto_ytd || 0,
      yoy_neto: bn_marca?.yoy_neto || 0, yoy_bruto: bn_marca?.yoy_bruto || 0,
      pct_trade: bn_marca?.pct_trade_ytd || 0,
      coverage: inv_data?.coverage_days || 0, stock: inv_data?.stock_units || 0,
      tp_score: tp_marca?.tp_score_pct || 0, tp_obj: tp_marca?.objetivo_pct || 85,
      weeks: weeks,
    }
  }).filter(d => d.neto_w12 > 0 || d.neto_ytd > 0).sort((a, b) => b.neto_ytd - a.neto_ytd)

  // Totals for KPI header
  const totalNetoYTD = marcaData.reduce((s, d) => s + d.neto_ytd, 0)
  const totalNetoYTDLY = marcaData.reduce((s, d) => s + d.neto_ytd_ly, 0)
  const totalNetoW12 = marcaData.reduce((s, d) => s + d.neto_w12, 0)
  const totalNetoW12LY = marcaData.reduce((s, d) => s + d.neto_w12_ly, 0)
  const yoyYTD = totalNetoYTDLY > 0 ? ((totalNetoYTD - totalNetoYTDLY) / totalNetoYTDLY * 100) : 0
  const yoyLW = totalNetoW12LY > 0 ? ((totalNetoW12 - totalNetoW12LY) / totalNetoW12LY * 100) : 0
  const siData = Object.values(sellin).reduce((s, a) => s + (a.real_neto_q1 || a.real_trim || 0), 0)
  const avgTP = marcaData.length > 0 ? marcaData.reduce((s, d) => s + d.tp_score, 0) / marcaData.length : 0

  // Chart: bars = LY, line = TY (total across all accounts)
  const weekLabels = sellout["wmt"]?.weeks || []
  const totalChartData = weekLabels.map((week, i) => {
    let ty = 0
    let ly = 0
    accounts.forEach(acc => {
      const weeks = sellout[acc.id]?.skus?.[selectedMarca] || []
      const val = weeks[i] || 0
      ty += val
      // Estimate LY: use YoY ratio
      const bn_marca = brutoNeto[acc.id]?.marcas?.find(m => m.marca === selectedMarca)
      const yoy = bn_marca?.yoy_neto || 0
      ly += yoy !== 0 ? Math.round(val / (1 + yoy/100)) : val
    })
    return { week, "2026": Math.round(ty/1000), "2025": Math.round(ly/1000) }
  })

  // Per-account chart when expanded
  const accountChartData = expandedAccount ? weekLabels.map((week, i) => {
    const weeks = sellout[expandedAccount]?.skus?.[selectedMarca] || []
    const val = weeks[i] || 0
    const bn_marca = brutoNeto[expandedAccount]?.marcas?.find(m => m.marca === selectedMarca)
    const yoy = bn_marca?.yoy_neto || 0
    const ly = yoy !== 0 ? Math.round(val / (1 + yoy/100)) : val
    return { week, "2026": Math.round(val/1000), "2025": Math.round(ly/1000) }
  }) : []

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Vista por Marca - Comparativo entre Clientes</div>
        <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 12 }}>Selecciona una marca · Barras = 2025 · Linea = 2026 · Sell-Out Neto</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {allMarcas.map(m => (
            <button key={m} onClick={() => { setSelectedMarca(m); setExpandedAccount(null) }} className={"btn " + (selectedMarca === m ? "btn-primary" : "btn-secondary")} style={{ fontSize: 11, padding: "4px 10px" }}>{m}</button>
          ))}
        </div>
      </div>
      {selectedMarca && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
            <div className="metric-card" style={{ borderLeft: "3px solid var(--primary)" }}>
              <div className="metric-label">SO Neto YTD</div>
              <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{formatMXN(totalNetoYTD, true)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: yoyYTD >= 0 ? "var(--success)" : "var(--critical)", marginTop: 4 }}>{yoyYTD >= 0 ? "+" : ""}{yoyYTD.toFixed(1)}% vs LY</div>
            </div>
            <div className="metric-card" style={{ borderLeft: "3px solid var(--cyan)" }}>
              <div className="metric-label">SO Neto LW (W12)</div>
              <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{formatMXN(totalNetoW12, true)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: yoyLW >= 0 ? "var(--success)" : "var(--critical)", marginTop: 4 }}>{yoyLW >= 0 ? "+" : ""}{yoyLW.toFixed(1)}% vs LY</div>
            </div>
            <div className="metric-card" style={{ borderLeft: "3px solid var(--info)" }}>
              <div className="metric-label">SI Neto YTD</div>
              <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{formatMXN(siData, true)}</div>
              <div className="metric-sub">Sell-In Q1 acumulado</div>
            </div>
            <div className="metric-card" style={{ borderLeft: "3px solid var(--warning)" }}>
              <div className="metric-label">TP Promedio</div>
              <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: avgTP >= 75 ? "var(--success)" : avgTP >= 60 ? "var(--warning)" : "var(--critical)" }}>{avgTP.toFixed(0)}%</div>
              <div className="metric-sub">vs obj 85%</div>
            </div>
            <div className="metric-card" style={{ borderLeft: "3px solid var(--success)" }}>
              <div className="metric-label">Clientes Activos</div>
              <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}>{marcaData.length}</div>
              <div className="metric-sub">de {accounts.length} cuentas</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{selectedMarca} - Sell-Out Neto {expandedAccount ? accounts.find(a=>a.id===expandedAccount)?.name : "Total"} (miles MXN)</div>
                <div style={{ fontSize: 11, color: "var(--silver)" }}>Barras = 2025 · Linea = 2026</div>
              </div>
              {expandedAccount && <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 12px" }} onClick={() => setExpandedAccount(null)}>Ver Total</button>}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={expandedAccount ? accountChartData : totalChartData}>
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

          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{selectedMarca} - Performance por Cliente</div>
            <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 12 }}>Click en un cliente para ver su evolutivo semanal</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style={{ textAlign: "right" }}>SO Neto YTD</th>
                  <th style={{ textAlign: "right" }}>vs LY</th>
                  <th style={{ textAlign: "right" }}>SO Neto LW</th>
                  <th style={{ textAlign: "right" }}>vs LY</th>
                  <th style={{ textAlign: "right" }}>Inventario</th>
                  <th style={{ textAlign: "right" }}>TP Score</th>
                  <th style={{ textAlign: "right" }}>% Trade</th>
                </tr>
              </thead>
              <tbody>
                {marcaData.map((d, i) => {
                  const covColor = d.coverage < 7 ? "var(--critical)" : d.coverage < 14 ? "var(--warning)" : "var(--success)"
                  const tpColor = d.tp_score >= 75 ? "var(--success)" : d.tp_score >= 60 ? "var(--warning)" : "var(--critical)"
                  const isExpanded = expandedAccount === d.accountId
                  return (
                    <tr key={i} onClick={() => setExpandedAccount(isExpanded ? null : d.accountId)} style={{ cursor: "pointer", background: isExpanded ? "var(--primary-wash)" : "transparent" }}>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 22, height: 22, borderRadius: 4, background: d.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white" }}>{d.logo}</div><span style={{ fontWeight: 700 }}>{d.accountShort}</span>{isExpanded && <span style={{ fontSize: 9, color: "var(--primary)" }}>ver grafica</span>}</div></td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{formatMXN(d.neto_ytd, true)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: d.yoy_neto >= 0 ? "var(--success)" : "var(--critical)" }}>{d.yoy_neto > 0 ? "+" : ""}{d.yoy_neto}%</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{formatMXN(d.neto_w12, true)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: d.yoy_neto >= 0 ? "var(--success)" : "var(--critical)" }}>{d.yoy_neto > 0 ? "+" : ""}{d.yoy_neto}%</td>
                      <td style={{ textAlign: "right" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: covColor }}>{d.coverage}d</span><span style={{ fontSize: 9, color: "var(--silver)", marginLeft: 4 }}>{d.stock.toLocaleString()} uds</span></td>
                      <td style={{ textAlign: "right" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: tpColor }}>{d.tp_score > 0 ? d.tp_score.toFixed(0) + "%" : "—"}</span></td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: d.pct_trade > 25 ? "var(--critical)" : "var(--silver)" }}>{d.pct_trade}%</td>
                    </tr>
                  )
                })}
                <tr style={{ background: "var(--pearl)", fontWeight: 800 }}>
                  <td style={{ fontWeight: 800 }}>TOTAL</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800 }}>{formatMXN(totalNetoYTD, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: yoyYTD >= 0 ? "var(--success)" : "var(--critical)" }}>{yoyYTD >= 0 ? "+" : ""}{yoyYTD.toFixed(1)}%</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800 }}>{formatMXN(totalNetoW12, true)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: yoyLW >= 0 ? "var(--success)" : "var(--critical)" }}>{yoyLW >= 0 ? "+" : ""}{yoyLW.toFixed(1)}%</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SellOutDrillDown({ onClose }) {
  const soByAccount = accounts.map(acc => {
    const total = Object.values(sellout[acc.id].skus).reduce((s, w) => s + w[w.length-1], 0)
    const prev = Object.values(sellout[acc.id].skus).reduce((s, w) => s + w[w.length-2], 0)
    return { name: acc.name.split(" ")[0], actual: Math.round(total/1000), anterior: Math.round(prev/1000) }
  })
  const soWeekly = sellout["wmt"].weeks.map((week, i) => {
    const entry = { week }
    accounts.forEach(acc => { entry[acc.name.split(" ")[0]] = Math.round(Object.values(sellout[acc.id].skus).reduce((s,w)=>s+w[i],0)/1000) })
    return entry
  })
  return (
    <div style={{ background: "var(--white)", border: "1px solid #E2E8F0", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Sell-Out Neto - Tendencia Semanal por Cuenta (miles MXN)</div>
        <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: "6px 14px" }}>Cerrar</button>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={soWeekly}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888780" }} />
          <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => ["$" + v + "K MXN",""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {accounts.map((acc, i) => <Line key={acc.id} type="monotone" dataKey={acc.name.split(" ")[0]} stroke={SKU_COLORS[i]} strokeWidth={2} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Ultima semana vs anterior por cuenta (Neto)</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={soByAccount}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888780" }} />
          <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => ["$" + v + "K MXN",""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="actual" fill="#06B6D4" name="W12 Neto" radius={[4,4,0,0]} />
          <Bar dataKey="anterior" fill="#E2E8F0" name="W11 Neto" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BrandCard({ marca }) {
  const cfg = { revertir: { color: "var(--critical)", icon: "v" }, proteger: { color: "#92400E", icon: "!" }, capitalizar: { color: "var(--success)", icon: "^" } }[marca.categoria]
  return (
    <div style={{ background: "var(--white)", border: "1px solid #E2E8F0", borderLeft: "4px solid " + cfg.color, borderRadius: "var(--radius-md)", padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>{marca.marca}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{marca.sell_out_trend > 0 ? "+" : ""}{marca.sell_out_trend.toFixed(1)}%</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--silver)", marginBottom: 4 }}>{marca.razon}</div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "var(--silver)" }}>{marca.inventario_dias}d inv.</span>
        <span style={{ fontSize: 10, color: "var(--silver)" }}>SOM: {marca.market_share}%</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: "var(--font-mono)" }}>{formatMXN(marca.oportunidad_mxn, true)}</span>
      </div>
    </div>
  )
}

function BrandMap({ accountId }) {
  const marcas = brandMap[accountId] || []
  const revertir = marcas.filter(m => m.categoria === "revertir")
  const proteger = marcas.filter(m => m.categoria === "proteger")
  const capitalizar = marcas.filter(m => m.categoria === "capitalizar")
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Revertir ({revertir.length})</div>{revertir.map(m => <BrandCard key={m.marca} marca={m} />)}</div>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Proteger ({proteger.length})</div>{proteger.map(m => <BrandCard key={m.marca} marca={m} />)}</div>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Capitalizar ({capitalizar.length})</div>{capitalizar.map(m => <BrandCard key={m.marca} marca={m} />)}</div>
    </div>
  )
}

function ExecutionAlerts({ accountId }) {
  const items = (executionScorecard[accountId] || []).filter(i => i.estado === "off_track")
  if (items.length === 0) return <div style={{ fontSize: 13, color: "var(--success)", padding: "16px 0" }}>Sin alertas activas.</div>
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ background: "var(--critical-light)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 8, borderLeft: "4px solid var(--critical)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>{item.iniciativa}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", fontFamily: "var(--font-mono)" }}>{item.venta_perdida_mxn > 0 ? "-" + formatMXN(item.venta_perdida_mxn, true) + " MXN" : "Pendiente"}</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569" }}>{item.accion}</div>
        </div>
      ))}
    </div>
  )
}

function AccountCard({ account, onSelect }) {
  const health = getAccountHealth(account.id, inventory, funds)
  const lastWeekSO = getLastWeekSellout(sellout, account.id)
  const avgCov = getAvgCoverage(inventory, account.id)
  const critSkus = getCriticalSkus(inventory, account.id)
  const fundExec = funds[account.id].execution_pct
  const tp = tiendaPerfecta[account.id]
  const tpColor = tp ? (tp.score_general_pct >= 80 ? "var(--success)" : tp.score_general_pct >= 65 ? "var(--warning)" : "var(--critical)") : "var(--silver)"
  return (
    <div className="account-card" onClick={() => onSelect(account.id)}>
      <div className="account-card-header">
        <div className="account-icon" style={{ background: account.color }}>{account.logo_initials}</div>
        <div>
          <div className="account-name">{account.name}</div>
          <div className="account-type">{account.type} · {account.stores.toLocaleString()} tiendas</div>
        </div>
        <div style={{ marginLeft: "auto" }}><span className={"health-badge health-" + health}><span className={"health-dot dot-" + health} />{getHealthLabel(health)}</span></div>
      </div>
      {critSkus.length > 0 && <div className="alert alert-red" style={{ marginBottom: 8, padding: "6px 10px" }}><span>!</span><span>Riesgo quiebre: {critSkus.slice(0,3).join(", ")}</span></div>}
      <div className="account-stats">
        <div><div className="account-stat-label">Sell-Out Neto W12</div><div className="account-stat-value">{formatMXN(lastWeekSO, true)}</div></div>
        <div><div className="account-stat-label">Cobertura</div><div className="account-stat-value">{avgCov.toFixed(0)} dias</div></div>
        {tp && <div><div className="account-stat-label">Tienda Perfecta</div><div className="account-stat-value" style={{ color: tpColor }}>{tp.score_general_pct.toFixed(0)}%</div></div>}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="metric-label">Fondos ejecutados</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: fundExec < 50 ? "var(--critical)" : fundExec < 70 ? "var(--warning)" : "var(--success)" }}>{fundExec.toFixed(0)}%</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: Math.min(fundExec, 100) + "%", background: fundExec < 50 ? "var(--critical)" : fundExec < 70 ? "var(--warning)" : "var(--success)" }} /></div>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--silver)" }}>KAM: {account.kam}</span>
        {account.listed && <span className="chip chip-blue">BMV</span>}
      </div>
    </div>
  )
}

export default function Dashboard({ onSelectAccount, onModuleClick }) {
  const [activeSection, setActiveSection] = useState("scorecard")
  const [selectedAccount, setSelectedAccount] = useState("wmt")
  const [drillDown, setDrillDown] = useState(null)

  function toggleDrillDown(type) { setDrillDown(prev => prev === type ? null : type) }

  const summary = useMemo(() => {
    const total_so = accounts.reduce((sum, acc) => sum + getLastWeekSellout(sellout, acc.id), 0)
    const totalAlerts = accounts.reduce((sum, acc) => sum + (executionScorecard[acc.id] || []).filter(i => i.estado === "off_track").length, 0)
    const totalOpp = accounts.reduce((sum, acc) => sum + (executionScorecard[acc.id] || []).reduce((s, i) => s + (i.venta_perdida_mxn || 0), 0), 0)
    const si_real_acum = Object.values(sellin).reduce((s, a) => s + a.real_acum, 0)
    const si_obj_acum = Object.values(sellin).reduce((s, a) => s + a.objetivo_acum, 0)
    const si_vs_ly = Object.values(sellin).reduce((s, a) => s + a.vs_anterior_acum, 0) / Object.values(sellin).length
    const si_real_mes = Object.values(sellin).reduce((s, a) => s + a.real_mes, 0)
    const si_obj_mes = Object.values(sellin).reduce((s, a) => s + a.objetivo_mes, 0)
    const si_real_trim = Object.values(sellin).reduce((s, a) => s + a.real_trim, 0)
    const si_obj_trim = Object.values(sellin).reduce((s, a) => s + a.objetivo_trim, 0)
    const so_real_acum = si_real_acum * 1.08
    const so_obj_acum = si_obj_acum * 1.05
    const so_vs_ly = 4.8
    const avgCov = accounts.reduce((s, a) => s + getAvgCoverage(inventory, a.id), 0) / accounts.length
    const fondosExec = Object.values(funds).reduce((s, f) => s + f.execution_pct, 0) / Object.values(funds).length
    const avgTP = Object.values(tiendaPerfecta).reduce((s, t) => s + t.score_general_pct, 0) / Object.values(tiendaPerfecta).length
    const totalKBDOffTrack = Object.values(kbd).reduce((s, m) => s + m.kbds.filter(k => k.status === "off_track").length, 0)
    const totalBrutoW12 = Object.values(brutoNeto).reduce((s, d) => s + d.total_bruto_w12, 0)
    const totalNetoW12 = Object.values(brutoNeto).reduce((s, d) => s + d.total_neto_w12, 0)
    const totalTradeW12 = totalBrutoW12 - totalNetoW12
    const pctTradeW12 = totalBrutoW12 > 0 ? ((totalTradeW12 / totalBrutoW12) * 100).toFixed(1) : 0
    return { total_so, totalAlerts, totalOpp, si_real_acum, si_obj_acum, si_vs_ly, si_real_mes, si_obj_mes, si_real_trim, si_obj_trim, so_real_acum, so_obj_acum, so_vs_ly, avgCov, fondosExec, avgTP, totalKBDOffTrack, totalBrutoW12, totalNetoW12, totalTradeW12, pctTradeW12 }
  }, [])

  const account = accounts.find(a => a.id === selectedAccount)
  const accountSorted = [...accounts].sort((a, b) => {
    const aOpp = (executionScorecard[a.id] || []).reduce((s, i) => s + (i.venta_perdida_mxn || 0), 0)
    const bOpp = (executionScorecard[b.id] || []).reduce((s, i) => s + (i.venta_perdida_mxn || 0), 0)
    return bOpp - aOpp
  })

  const menuSections = [
    { id: "scorecard", label: "Scorecard General", icon: "\u25CB" },
    { id: "agenda", label: "Agenda KAM", icon: "!" },
    { id: "bruto_neto", label: "Bruto vs Neto", icon: "\u0394" },
    { id: "oc_sugerida", label: "OC Sugerida", icon: "\u2193" },
    { id: "marca_cliente", label: "Marca x Cliente", icon: "\u2194" },
    { id: "cuentas", label: "Detalle por Cuenta", icon: "=" },
    { id: "marcas", label: "Mapa de Marcas", icon: "+" },
    { id: "share", label: "Market Share", icon: "%" },
    { id: "tp", label: "Tienda Perfecta", icon: "T" },
    { id: "kbd", label: "KBDs por Marca", icon: "K" },
    { id: "alertas", label: "Alertas Ejecucion", icon: "x" },
  ]

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div style={{ width: 210, flexShrink: 0, background: "#141B2D", borderRadius: "var(--radius-lg)", padding: "16px 12px", minHeight: "calc(100vh - 140px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#8B95A5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Navegacion</div>
        {menuSections.map(item => (
          <div key={item.id} onClick={() => setActiveSection(item.id)} style={{ background: activeSection === item.id ? "rgba(6,182,212,0.15)" : "transparent", border: "1px solid " + (activeSection === item.id ? "var(--cyan)" : "transparent"), borderRadius: "var(--radius-md)", padding: "8px 10px", marginBottom: 3, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: activeSection === item.id ? "var(--cyan)" : "#8B95A5", width: 14, textAlign: "center" }}>{item.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: activeSection === item.id ? "var(--white)" : "#8B95A5" }}>{item.label}</span>
            </div>
          </div>
        ))}
        <div style={{ height: 1, background: "#1E2A3A", margin: "10px 0" }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: "#8B95A5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Modulos</div>
        {[
          { label: "Agente IA", action: "agent" },
          { label: "One-Pager + PPT", action: "onepager" },
          { label: "Presentacion", action: "presentacion" },
          { label: "Senales Bursatiles", action: "signals" }
        ].map((m, i) => (
          <div key={i} onClick={() => onModuleClick(m.action, selectedAccount)} style={{ border: "1px solid #1E2A3A", borderRadius: "var(--radius-md)", padding: "8px 10px", marginBottom: 3, cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(6,182,212,0.1)"; e.currentTarget.style.borderColor = "var(--cyan)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#1E2A3A" }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: "var(--cyan)" }}>{m.label}</div>
          </div>
        ))}
        <div style={{ height: 1, background: "#1E2A3A", margin: "10px 0" }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: "#8B95A5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Cuentas</div>
        {accountSorted.map(acc => {
          const tp = tiendaPerfecta[acc.id]
          const tpColor = tp ? (tp.score_general_pct >= 80 ? "#10B981" : tp.score_general_pct >= 65 ? "#F59E0B" : "#EF4444") : "#8B95A5"
          return (
            <div key={acc.id} onClick={() => onSelectAccount(acc.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", marginBottom: 2 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(6,182,212,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: acc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white", flexShrink: 0 }}>{acc.logo_initials}</div>
              <span style={{ fontSize: 11, color: "var(--cyan)", fontWeight: 600, flex: 1 }}>{acc.name.split(" ")[0]}</span>
              {tp && <span style={{ fontSize: 9, color: tpColor, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{tp.score_general_pct.toFixed(0)}%</span>}
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Scorecard de Ejecucion</h1>
          <p style={{ fontSize: 13, color: "var(--silver)" }}>Semana 12 · 2026 · {accounts.length} cuentas · Genomma Lab Mexico</p>
        </div>

        {activeSection === "scorecard" && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sell-Out Neto consolidado</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 8 }}>
              <KPICard label="SO Neto YTD (MXN)" value={formatMXN(summary.so_real_acum, true)} target={formatMXN(summary.so_obj_acum, true)} vsLY={summary.so_vs_ly} pct={(summary.so_real_acum / summary.so_obj_acum) * 100} onClick={() => toggleDrillDown("sellout")} />
              <KPICard label="SO Neto Semana (MXN)" value={formatMXN(summary.total_so, true)} target="Meta sem." vsLY={3.2} pct={94} onClick={() => toggleDrillDown("sellout")} />
              <AlertCard label="SO Bruto Semana" value={formatMXN(summary.totalBrutoW12, true)} sub={"Trade: " + formatMXN(summary.totalTradeW12, true) + " (" + summary.pctTradeW12 + "%)"} color="var(--info)" onClick={() => setActiveSection("bruto_neto")} />
              <AlertCard label="Cobertura Promedio" value={summary.avgCov.toFixed(0) + " dias"} sub="Minimo sano: 14 dias" color="var(--info)" />
            </div>
            {drillDown === "sellout" && <SellOutDrillDown onClose={() => setDrillDown(null)} />}

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 8 }}>Sell-In consolidado</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
              <KPICard label="Sell-In YTD (MXN)" value={formatMXN(summary.si_real_acum, true)} target={formatMXN(summary.si_obj_acum, true)} vsLY={summary.si_vs_ly} pct={(summary.si_real_acum / summary.si_obj_acum) * 100} />
              <KPICard label="Sell-In Mes (MXN)" value={formatMXN(summary.si_real_mes, true)} target={formatMXN(summary.si_obj_mes, true)} vsLY={summary.si_vs_ly} pct={(summary.si_real_mes / summary.si_obj_mes) * 100} />
              <KPICard label="Sell-In Trimestre (MXN)" value={formatMXN(summary.si_real_trim, true)} target={formatMXN(summary.si_obj_trim, true)} vsLY={summary.si_vs_ly} pct={(summary.si_real_trim / summary.si_obj_trim) * 100} />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 8 }}>Ejecucion, Tienda Perfecta y Riesgos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 8 }}>
              <AlertCard label="Venta en Riesgo (MXN)" value={formatMXN(summary.totalOpp, true)} sub="Por ejecucion pendiente" color="var(--critical)" />
              <AlertCard label="Gasto Fondos Prom." value={summary.fondosExec.toFixed(0) + "%"} sub="Prom. todas las cuentas" color={summary.fondosExec < 60 ? "var(--critical)" : summary.fondosExec < 75 ? "var(--warning)" : "var(--success)"} />
              <AlertCard label="Tienda Perfecta Prom." value={summary.avgTP.toFixed(0) + "%"} sub="vs objetivo 85%" color={summary.avgTP >= 80 ? "var(--success)" : summary.avgTP >= 65 ? "var(--warning)" : "var(--critical)"} onClick={() => setActiveSection("tp")} />
              <AlertCard label="KBDs Off-Track" value={summary.totalKBDOffTrack} sub="Actividades sin cumplir" color="var(--critical)" onClick={() => setActiveSection("kbd")} />
            </div>

            <div className="divider" />
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Radar de Cuentas - Ordenado por Oportunidad</div>
            <div className="accounts-grid">
              {accountSorted.map(acc => <AccountCard key={acc.id} account={acc} onSelect={onSelectAccount} />)}
            </div>
          </div>
        )}

        {activeSection === "agenda" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            {account && <AgendaKAM accountId={selectedAccount} />}
          </div>
        )}

        {activeSection === "bruto_neto" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <BrutoNetoModule accountId={selectedAccount} />
          </div>
        )}

        {activeSection === "oc_sugerida" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <OCModule accountId={selectedAccount} />
          </div>
        )}

        {activeSection === "marca_cliente" && <MarcaClienteModule />}

        {activeSection === "cuentas" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            {account && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: account.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>{account.logo_initials}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{account.name}</div>
                      <div style={{ fontSize: 12, color: "var(--silver)" }}>KAM: {account.kam} · {account.type} · {account.stores.toLocaleString()} tiendas</div>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => onSelectAccount(account.id)}>Analisis completo</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                  <KPICard label="Sell-In YTD (MXN)" value={formatMXN(sellin[account.id].real_acum, true)} target={formatMXN(sellin[account.id].objetivo_acum, true)} vsLY={sellin[account.id].vs_anterior_acum} pct={(sellin[account.id].real_acum / sellin[account.id].objetivo_acum) * 100} />
                  <KPICard label="Sell-In Mes (MXN)" value={formatMXN(sellin[account.id].real_mes, true)} target={formatMXN(sellin[account.id].objetivo_mes, true)} vsLY={sellin[account.id].vs_anterior_mes} pct={(sellin[account.id].real_mes / sellin[account.id].objetivo_mes) * 100} />
                  <AlertCard label="Gasto Fondos" value={funds[account.id].execution_pct.toFixed(0) + "%"} sub={formatMXN(funds[account.id].executed_ytd_mxn, true) + " de " + formatMXN(funds[account.id].annual_committed_mxn, true) + " MXN"} color={funds[account.id].execution_pct < 60 ? "var(--critical)" : "var(--success)"} />
                  <TPScoreCard accountId={selectedAccount} />
                </div>
                <div className="card">
                  <div className="section-title" style={{ marginBottom: 12 }}>Alertas de Ejecucion</div>
                  <ExecutionAlerts accountId={selectedAccount} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "marcas" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <div className="card">
              <div className="section-header" style={{ marginBottom: 14 }}>
                <div>
                  <div className="section-title">Mapa de Prioridades - {account && account.name}</div>
                  <div className="section-sub">Sell-Out Neto YoY · Inventario · Market Share · Oportunidad MXN</div>
                </div>
              </div>
              <BrandMap accountId={selectedAccount} />
            </div>
          </div>
        )}

        {activeSection === "share" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <MarketShareDetail accountId={selectedAccount} />
          </div>
        )}

        {activeSection === "tp" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <TPDetail accountId={selectedAccount} />
          </div>
        )}

        {activeSection === "kbd" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <KBDDetail accountId={selectedAccount} />
          </div>
        )}

        {activeSection === "alertas" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {accounts.map(acc => <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} className={"btn " + (selectedAccount === acc.id ? "btn-primary" : "btn-secondary")} style={{ fontSize: 12, padding: "6px 14px" }}>{acc.name}</button>)}
            </div>
            <div className="card">
              <div className="section-title" style={{ marginBottom: 12 }}>Alertas de Ejecucion - {account && account.name}</div>
              <ExecutionAlerts accountId={selectedAccount} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
