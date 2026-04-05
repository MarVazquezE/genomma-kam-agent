import { useMemo, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts"
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
import { formatMXN, getAccountHealth, getHealthLabel, getLastWeekSellout, getAvgCoverage, getCriticalSkus } from "../utils/helpers"

const SKU_COLORS = ["#6366F1","#14B8A6","#F59E0B","#F43F5E","#8B5CF6","#06B6D4"]

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
      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: tp.tendencia === "alza" ? "var(--success)" : tp.tendencia === "baja" ? "var(--critical)" : "var(--silver)" }}>
        Tendencia: {tp.tendencia}
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
      ejecutar.push({ tipo: "Tienda Perfecta", accion: ind.nombre + " - Critico: " + ind.marcas_criticas.join(", "), impacto: "TP Score: " + tp.score_general_pct.toFixed(0) + "% vs obj " + tp.objetivo_pct + "%", urgencia: "alta" })
    })
  }

  if (ms) {
    Object.entries(ms.categorias).forEach(([cat, data]) => {
      data.marcas.filter(m => !m.es_competidor && m.tendencia === "baja").forEach(m => {
        negociar.push({ tipo: "Market Share", accion: "Defender SOM " + m.marca + " en " + cat + " - Actual " + m.som_pct + "% vs " + m.competidor + " " + m.competidor_som_pct + "%", impacto: "Gap: " + m.gap_liderazgo_pts.toFixed(1) + " pts", urgencia: Math.abs(m.gap_liderazgo_pts) > 10 ? "alta" : "media" })
      })
    })
  }

  scorecard.filter(i => i.estado === "off_track").forEach(item => {
    negociar.push({ tipo: "Ejecucion", accion: item.iniciativa + " - " + item.accion, impacto: item.venta_perdida_mxn > 0 ? "Venta perdida: " + formatMXN(item.venta_perdida_mxn, true) + " MXN" : "Pendiente", urgencia: "alta" })
  })

  brandas.filter(m => m.categoria === "revertir").slice(0, 2).forEach(m => {
    ejecutar.push({ tipo: "Sell-Out", accion: "Plan recuperacion " + m.marca + " - Caida " + m.sell_out_trend.toFixed(1) + "% YoY", impacto: "Gap YTD: " + formatMXN(Math.abs(m.gap_ytd), true) + " MXN", urgencia: "alta" })
  })

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Agenda KAM Esta Semana</div>
      <div style={{ fontSize: 12, color: "var(--silver)", marginBottom: 12 }}>Prioridades basadas en sell-out, share, Tienda Perfecta y KBDs</div>
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
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{m.marca}</td>
                    <td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--font-mono)" }}>{m.dispo_pct.toFixed(0)}%</td>
                    <td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--font-mono)" }}>{m.precio_ok_pct.toFixed(0)}%</td>
                    <td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--font-mono)" }}>{m.exhibicion_pct.toFixed(0)}%</td>
                    <td style={{ textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: "var(--font-mono)" }}>{m.tp_score_pct.toFixed(0)}%</span></td>
                  </tr>
                )
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
            const isGeomma = !m.es_competidor
            const c = isGeomma ? (m.tendencia === "alza" ? "var(--success)" : m.tendencia === "baja" ? "var(--critical)" : "var(--silver)") : "#CBD5E1"
            return (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: isGeomma ? c : "#CBD5E1", display: "inline-block" }} />
                    <span style={{ fontSize: 11, fontWeight: isGeomma ? 700 : 400, color: isGeomma ? "var(--obsidian)" : "var(--silver)" }}>{m.marca}</span>
                    {isGeomma && <span style={{ fontSize: 9, background: m.tendencia === "alza" ? "var(--success-light)" : m.tendencia === "baja" ? "var(--critical-light)" : "#F0F2F5", color: c, padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>{m.tendencia}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: isGeomma ? 800 : 400, color: isGeomma ? c : "var(--silver)", fontFamily: "var(--font-mono)" }}>{m.som_pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: "#F0F2F5", borderRadius: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, width: m.som_pct + "%", background: isGeomma ? c : "#CBD5E1" }} />
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
              <span style={{ fontSize: 11, color: "var(--silver)" }}>Objetivo Venta Neta: <strong style={{ color: data.objetivo_venta_neta_pct > 0 ? "var(--success)" : "var(--critical)" }}>{data.objetivo_venta_neta_pct > 0 ? "+" : ""}{data.objetivo_venta_neta_pct}%</strong></span>
              <span style={{ fontSize: 11, color: "var(--silver)" }}>SOM objetivo: <strong style={{ color: "var(--primary)" }}>+{data.objetivo_som_pts}pts</strong></span>
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
                  <div style={{ fontSize: 11, color: "var(--obsidian)", marginBottom: 2 }}><strong>[{k.area}]</strong> {k.descripcion.substring(0, 90)}{k.descripcion.length > 90 ? "..." : ""}</div>
                  <div style={{ fontSize: 10, color: "var(--silver)" }}>Impacto esperado: {k.impacto}</div>
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
        <div style={{ fontSize: 15, fontWeight: 800 }}>Sell-Out - Tendencia Semanal por Cuenta (miles MXN)</div>
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
      <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Ultima semana vs anterior por cuenta</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={soByAccount}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888780" }} />
          <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => ["$" + v + "K MXN",""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="actual" fill="#06B6D4" name="Sem. actual" radius={[4,4,0,0]} />
          <Bar dataKey="anterior" fill="#E2E8F0" name="Sem. anterior" radius={[4,4,0,0]} />
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
        <span style={{ fontSize: 10, color: "var(--silver)" }}>{marca.inventario_dias} dias inv.</span>
        <span style={{ fontSize: 10, color: "var(--silver)" }}>SOM: {marca.market_share}%</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: "var(--font-mono)" }}>{formatMXN(marca.oportunidad_mxn, true)} MXN</span>
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
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Revertir ({revertir.length})</div>
        {revertir.map(m => <BrandCard key={m.marca} marca={m} />)}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Proteger ({proteger.length})</div>
        {proteger.map(m => <BrandCard key={m.marca} marca={m} />)}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Capitalizar ({capitalizar.length})</div>
        {capitalizar.map(m => <BrandCard key={m.marca} marca={m} />)}
      </div>
    </div>
  )
}

function ExecutionAlerts({ accountId }) {
  const items = (executionScorecard[accountId] || []).filter(i => i.estado === "off_track" || i.estado === "pendiente")
  if (items.length === 0) return <div style={{ fontSize: 13, color: "var(--success)", padding: "16px 0" }}>Sin alertas activas.</div>
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ background: item.estado === "off_track" ? "var(--critical-light)" : "var(--warning-light)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 8, borderLeft: "4px solid " + (item.estado === "off_track" ? "var(--critical)" : "var(--warning)") }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>{item.iniciativa}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", fontFamily: "var(--font-mono)" }}>{item.venta_perdida_mxn > 0 ? "-" + formatMXN(item.venta_perdida_mxn, true) + " MXN" : "Pendiente"}</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{item.accion}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--critical)", textTransform: "uppercase" }}>{item.estado}</span>
            <span style={{ fontSize: 10, color: "var(--silver)" }}>Avance: {item.avance_pct}% / Meta: {item.objetivo_pct}%</span>
          </div>
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
  const offTrackCount = (executionScorecard[account.id] || []).filter(i => i.estado === "off_track").length
  const tp = tiendaPerfecta[account.id]
  const isOxxo = account.id === "oxxo"
  const tpColor = tp ? (tp.score_general_pct >= 80 ? "var(--success)" : tp.score_general_pct >= 65 ? "var(--warning)" : "var(--critical)") : "var(--silver)"
  return (
    <div className="account-card" onClick={() => onSelect(account.id)} style={{ borderColor: isOxxo ? "var(--critical)" : undefined }}>
      <div className="account-card-header">
        <div className="account-icon" style={{ background: account.color }}>{account.logo_initials}</div>
        <div>
          <div className="account-name">{account.name}</div>
          <div className="account-type">{account.type} · {account.stores.toLocaleString()} tiendas</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span className={"health-badge health-" + health}><span className={"health-dot dot-" + health} />{getHealthLabel(health)}</span>
        </div>
      </div>
      {isOxxo && <div className="alert alert-red" style={{ marginBottom: 8, padding: "6px 10px" }}><span>!</span><span>Suerox -36% · Exceso gasto vs facturacion</span></div>}
      {!isOxxo && critSkus.length > 0 && <div className="alert alert-red" style={{ marginBottom: 8, padding: "6px 10px" }}><span>!</span><span>Riesgo quiebre: {critSkus.join(", ")}</span></div>}
      <div className="account-stats">
        <div><div className="account-stat-label">Sell-Out Sem.</div><div className="account-stat-value">{formatMXN(lastWeekSO, true)}</div></div>
        <div><div className="account-stat-label">Cobertura</div><div className="account-stat-value">{avgCov.toFixed(0)} dias</div></div>
        {tp && <div><div className="account-stat-label">Tienda Perfecta</div><div className="account-stat-value" style={{ color: tpColor }}>{tp.score_general_pct.toFixed(0)}%</div></div>}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="metric-label">Fondos ejecutados</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: fundExec < 50 ? "var(--critical)" : fundExec < 70 ? "var(--warning)" : "var(--success)" }}>{fundExec.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: Math.min(fundExec, 100) + "%", background: fundExec < 50 ? "var(--critical)" : fundExec < 70 ? "var(--warning)" : "var(--success)" }} />
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--silver)" }}>KAM: {account.kam}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {offTrackCount > 0 && <span className="chip chip-red">{offTrackCount} alertas</span>}
          {account.listed && <span className="chip chip-blue">BMV</span>}
        </div>
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
    const atRisk = accounts.filter(a => getAccountHealth(a.id, inventory, funds) === "red").length
    const totalAlerts = accounts.reduce((sum, acc) => sum + (executionScorecard[acc.id] || []).filter(i => i.estado === "off_track").length, 0)
    const totalOpp = accounts.reduce((sum, acc) => sum + (executionScorecard[acc.id] || []).reduce((s, i) => s + i.venta_perdida_mxn, 0), 0)
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
    const gap_si_so_pct = ((so_real_acum - si_real_acum) / si_real_acum) * 100
    const gap_alert = gap_si_so_pct > 25 ? "sobreinventario" : gap_si_so_pct < -15 ? "quiebre" : null
    const avgTP = Object.values(tiendaPerfecta).reduce((s, t) => s + t.score_general_pct, 0) / Object.values(tiendaPerfecta).length
    const totalKBDOffTrack = Object.values(kbd).reduce((s, m) => s + m.kbds.filter(k => k.status === "off_track").length, 0)
    return { total_so, atRisk, totalAlerts, totalOpp, si_real_acum, si_obj_acum, si_vs_ly, si_real_mes, si_obj_mes, si_real_trim, si_obj_trim, so_real_acum, so_obj_acum, so_vs_ly, avgCov, fondosExec, gap_si_so_pct, gap_alert, avgTP, totalKBDOffTrack }
  }, [])

  const account = accounts.find(a => a.id === selectedAccount)

  const accountSorted = [...accounts].sort((a, b) => {
    const aOpp = (executionScorecard[a.id] || []).reduce((s, i) => s + i.venta_perdida_mxn, 0)
    const bOpp = (executionScorecard[b.id] || []).reduce((s, i) => s + i.venta_perdida_mxn, 0)
    return bOpp - aOpp
  })

  const menuSections = [
    { id: "scorecard", label: "Scorecard General", icon: "o" },
    { id: "agenda", label: "Agenda KAM", icon: "!" },
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
        <div style={{ fontSize: 10, fontWeight: 700, color: "#8B95A5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Cuentas - Por Prioridad</div>
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
            {summary.gap_alert && (
              <div className={"alert " + (summary.gap_alert === "quiebre" ? "alert-red" : "alert-amber")} style={{ marginBottom: 12 }}>
                <span>!</span>
                <div>
                  <strong>{summary.gap_alert === "quiebre" ? "Alerta: Riesgo de quiebre" : "Alerta: Posible sobreinventario"}</strong>
                  <div style={{ fontSize: 12, marginTop: 2 }}>Desviacion Sell-Out vs Sell-In: {Math.abs(summary.gap_si_so_pct).toFixed(1)}%</div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sell-Out consolidado</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
              <KPICard label="Sell-Out YTD (MXN)" value={formatMXN(summary.so_real_acum, true)} target={formatMXN(summary.so_obj_acum, true)} vsLY={summary.so_vs_ly} pct={(summary.so_real_acum / summary.so_obj_acum) * 100} onClick={() => toggleDrillDown("sellout")} />
              <KPICard label="Sell-Out Semana (MXN)" value={formatMXN(summary.total_so, true)} target="Meta sem." vsLY={3.2} pct={94} onClick={() => toggleDrillDown("sellout")} />
              <AlertCard label="Cobertura Promedio" value={summary.avgCov.toFixed(0) + " dias"} sub="Minimo sano: 14 dias" color="var(--info)" />
            </div>
            {drillDown === "sellout" && <SellOutDrillDown onClose={() => setDrillDown(null)} />}

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 8 }}>Sell-In consolidado</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
              <KPICard label="Sell-In YTD (MXN)" value={formatMXN(summary.si_real_acum, true)} target={formatMXN(summary.si_obj_acum, true)} vsLY={summary.si_vs_ly} pct={(summary.si_real_acum / summary.si_obj_acum) * 100} onClick={() => toggleDrillDown("sellin")} />
              <KPICard label="Sell-In Mes (MXN)" value={formatMXN(summary.si_real_mes, true)} target={formatMXN(summary.si_obj_mes, true)} vsLY={summary.si_vs_ly} pct={(summary.si_real_mes / summary.si_obj_mes) * 100} />
              <KPICard label="Sell-In Trimestre (MXN)" value={formatMXN(summary.si_real_trim, true)} target={formatMXN(summary.si_obj_trim, true)} vsLY={summary.si_vs_ly} pct={(summary.si_real_trim / summary.si_obj_trim) * 100} />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 8 }}>Ejecucion, Tienda Perfecta y Riesgos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 8 }}>
              <AlertCard label="Venta en Riesgo (MXN)" value={formatMXN(summary.totalOpp, true)} sub="Por ejecucion pendiente" color="var(--critical)" onClick={() => toggleDrillDown("alertas")} />
              <AlertCard label="Gasto Fondos Prom." value={summary.fondosExec.toFixed(0) + "%"} sub="Prom. todas las cuentas" color={summary.fondosExec < 60 ? "var(--critical)" : summary.fondosExec < 75 ? "var(--warning)" : "var(--success)"} onClick={() => toggleDrillDown("fondos")} />
              <AlertCard label="Tienda Perfecta Prom." value={summary.avgTP.toFixed(0) + "%"} sub="vs objetivo 85%" color={summary.avgTP >= 80 ? "var(--success)" : summary.avgTP >= 65 ? "var(--warning)" : "var(--critical)"} onClick={() => toggleDrillDown("tp")} />
              <AlertCard label="KBDs Off-Track" value={summary.totalKBDOffTrack} sub="Actividades sin cumplir" color="var(--critical)" onClick={() => toggleDrillDown("kbd")} />
            </div>
            {drillDown === "alertas" && (
              <div style={{ background: "var(--white)", border: "1px solid #E2E8F0", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Alertas Off-Track - Todas las Cuentas</div>
                  <button className="btn btn-secondary" onClick={() => setDrillDown(null)} style={{ fontSize: 12 }}>Cerrar</button>
                </div>
                {accounts.map(acc => (executionScorecard[acc.id] || []).filter(i => i.estado === "off_track").map((item, i) => (
                  <div key={acc.id+i} style={{ background: "var(--critical-light)", borderRadius: "var(--radius-md)", padding: "8px 12px", marginBottom: 6, borderLeft: "3px solid var(--critical)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div><strong>{item.iniciativa}</strong><span style={{ fontSize: 11, color: "var(--silver)", marginLeft: 8 }}>- {acc.name}</span></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", fontFamily: "var(--font-mono)" }}>{item.venta_perdida_mxn > 0 ? "-" + formatMXN(item.venta_perdida_mxn, true) + " MXN" : "Pendiente"}</span>
                    </div>
                  </div>
                )))}
              </div>
            )}
            {drillDown === "tp" && <TPDetail accountId={selectedAccount} onClose={() => setDrillDown(null)} />}
            {drillDown === "kbd" && <KBDDetail accountId={selectedAccount} onClose={() => setDrillDown(null)} />}

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
                  <TPScoreCard accountId={selectedAccount} onClick={() => toggleDrillDown("tp_detail")} />
                </div>
                {drillDown === "tp_detail" && <TPDetail accountId={selectedAccount} onClose={() => setDrillDown(null)} />}
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
                  <div className="section-sub">Sell-out YoY · Inventario · Market Share · Oportunidad MXN</div>
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