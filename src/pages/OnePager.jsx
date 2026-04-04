import { useState } from "react"
import PptxGenJS from "pptxgenjs"
import accounts from "../data/accounts.json"
import sellout from "../data/sellout.json"
import inventory from "../data/inventory.json"
import funds from "../data/funds.json"
import sellin from "../data/sellin.json"
import brandMap from "../data/brand_map.json"
import brandContext from "../data/brand_context.json"
import executionScorecard from "../data/execution_scorecard.json"
import marketShare from "../data/market_share.json"
import tiendaPerfecta from "../data/tienda_perfecta.json"
import kbd from "../data/kbd.json"
import { formatMXN, getLastWeekSellout, getAvgCoverage } from "../utils/helpers"

const CLIENT_THEMES = {
  wmt: { primary: "0071CE", accent: "FFFFFF", name: "Walmart Mexico", font: "Arial" },
  ched: { primary: "CC1720", accent: "FFFFFF", name: "Chedraui", font: "Arial" },
  sor: { primary: "003A7A", accent: "FFFFFF", name: "Soriana", font: "Arial" },
  oxxo: { primary: "CC1A22", accent: "FFFFFF", name: "OXXO", font: "Arial" },
  ahorro: { primary: "007A3D", accent: "FFFFFF", name: "Farmacias del Ahorro", font: "Arial" },
  costco: { primary: "004A8F", accent: "FFFFFF", name: "Costco Mexico", font: "Arial" },
}

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

function getCategoriasMarcas(marcas) {
  const cats = {}
  marcas.forEach(m => {
    Object.entries(brandContext.categorias).forEach(([cat, data]) => {
      if (data.marcas.some(bm => bm.toLowerCase() === m.marca.toLowerCase())) {
        if (!cats[cat]) cats[cat] = { ...data, marcas_cuenta: [] }
        cats[cat].marcas_cuenta.push(m)
      }
    })
  })
  return cats
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      system: "Eres un consultor comercial senior de consumo masivo en Mexico experto en negociaciones con compradores de autoservicio. Generas planes comerciales estrategicos que los KAMs usan para negociar con compradores de Walmart, Chedraui, Soriana, OXXO y Farmacias. REGLAS CRITICAS: NUNCA mezcles estrategias entre categorias distintas. Cada categoria tiene sus propias palancas. Las recomendaciones deben ser especificas, accionables y cuantificadas en MXN. El tono es de socio comercial, no de proveedor. Enfoca en lo que el comprador gana: rotacion, margen, satisfaccion del shopper, market share de categoria. Cada palanca debe tener un KBD especifico que la sustenta.",
      messages: [{ role: "user", content: prompt }]
    })
  })
  const data = await res.json()
  const raw = data.content[0].text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(raw)
}

async function generateOnePager(account, marcas) {
  const cats = getCategoriasMarcas(marcas)
  const ms = marketShare[account.id]
  const tp = tiendaPerfecta[account.id]
  const kbdRelevante = marcas.slice(0, 4).map(m => ({ marca: m.marca, kbds: (kbd[m.marca] || {}).kbds || [] }))

  const context = {
    cuenta: account.name,
    tipo: account.type,
    tiendas: account.stores,
    sell_out_semana_mxn: getLastWeekSellout(sellout, account.id),
    cobertura_promedio_dias: getAvgCoverage(inventory, account.id).toFixed(0),
    sell_in_ytd_mxn: sellin[account.id].real_acum,
    sell_in_objetivo_ytd_mxn: sellin[account.id].objetivo_acum,
    sell_in_cumplimiento_pct: ((sellin[account.id].real_acum / sellin[account.id].objetivo_acum) * 100).toFixed(1),
    fondos_ejecutados_pct: funds[account.id].execution_pct,
    fondos_disponibles_mxn: funds[account.id].annual_committed_mxn - funds[account.id].executed_ytd_mxn,
    tienda_perfecta_score: tp ? tp.score_general_pct : null,
    tienda_perfecta_gaps: tp ? tp.indicadores.filter(i => i.status === "off_track").map(i => i.nombre) : [],
    market_share_por_categoria: ms ? Object.entries(ms.categorias).slice(0, 3).map(([cat, d]) => ({
      categoria: cat,
      marcas_genomma: d.marcas.filter(m => !m.es_competidor).map(m => ({
        marca: m.marca, som: m.som_pct, vs_anterior: m.som_anterior_pct,
        tendencia: m.tendencia, competidor: m.competidor, competidor_som: m.competidor_som_pct
      }))
    })) : [],
    kbds_criticos: kbdRelevante.flatMap(m => m.kbds.filter(k => k.status === "off_track").slice(0, 2).map(k => ({
      marca: m.marca, area: k.area, cumplimiento: k.cumplimiento_pct, impacto: k.impacto
    }))).slice(0, 5),
    categorias_con_marcas: Object.entries(cats).map(([cat, data]) => ({
      categoria: cat, descripcion: data.descripcion, palancas_disponibles: data.palancas,
      marcas: data.marcas_cuenta.map(m => ({
        marca: m.marca, tendencia_yoy_pct: m.sell_out_trend, venta_ytd_mxn: m.venta_ytd,
        gap_ytd_mxn: m.gap_ytd, dias_inventario: m.inventario_dias,
        market_share_pct: m.market_share, clasificacion: m.categoria
      }))
    })),
    reglas_importantes: brandContext.reglas_recomendacion.slice(0, 4)
  }

  return await callClaude(
    `Genera un plan comercial ejecutivo para presentar al comprador de ${account.name}.

DATOS COMPLETOS:
${JSON.stringify(context, null, 2)}

Responde SOLO en este JSON sin texto adicional:
{
  "titulo": "titulo ejecutivo impactante con cifra de oportunidad en MXN",
  "headline_oportunidad": "1 oracion que resume la oportunidad total para el comprador en MXN",
  "resumen_ejecutivo": "3 oraciones con estado actual cuantificado enfocado en lo que el comprador gana",
  "semaforo_negocio": "verde|amarillo|rojo",
  "estado_por_categoria": [
    {
      "categoria": "nombre categoria",
      "marcas": ["lista"],
      "ventas_ytd_mxn": 0,
      "gap_ytd_mxn": 0,
      "tendencia_pct": 0,
      "market_share_pct": 0,
      "diagnostico": "1 oracion con el diagnostico especifico de esta categoria en MXN"
    }
  ],
  "oportunidades_tienda_perfecta": [
    {
      "indicador": "nombre del gap",
      "gap_actual_pct": 0,
      "objetivo_pct": 0,
      "impacto_ventas_mxn": 0,
      "accion_concreta": "que debe hacer el comprador para cerrar este gap"
    }
  ],
  "palancas": [
    {
      "numero": 1,
      "categoria": "categoria especifica",
      "palanca": "nombre de la palanca comercial",
      "kbd_que_sustenta": "el KBD especifico que justifica esta palanca",
      "que_pone_genomma": "inversion material descuento que pone Genomma",
      "que_pone_el_cliente": "anaquel exhibicion precio activacion que pone el comprador",
      "marcas_impactadas": ["solo marcas de esa categoria"],
      "impacto_venta_incremental_mxn": 0,
      "impacto_som_pts": 0,
      "plazo": "inmediato|2-4 semanas|mes"
    },
    {
      "numero": 2,
      "categoria": "...",
      "palanca": "...",
      "kbd_que_sustenta": "...",
      "que_pone_genomma": "...",
      "que_pone_el_cliente": "...",
      "marcas_impactadas": [],
      "impacto_venta_incremental_mxn": 0,
      "impacto_som_pts": 0,
      "plazo": "..."
    },
    {
      "numero": 3,
      "categoria": "...",
      "palanca": "...",
      "kbd_que_sustenta": "...",
      "que_pone_genomma": "...",
      "que_pone_el_cliente": "...",
      "marcas_impactadas": [],
      "impacto_venta_incremental_mxn": 0,
      "impacto_som_pts": 0,
      "plazo": "..."
    }
  ],
  "compromiso_comprador": "la accion especifica que le pides al comprador que confirme en esta reunion",
  "siguiente_paso_genomma": "lo que Genomma se compromete a entregar en la proxima semana"
}`
  )
}

async function generatePPTX(account, op, marcas) {
  const theme = CLIENT_THEMES[account.id] || CLIENT_THEMES.wmt
  const ms = marketShare[account.id]
  const tp = tiendaPerfecta[account.id]
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_WIDE"
  const PRIM = "#" + theme.primary
  const DARK = "#1A1A2E"
  const GRAY = "#555555"
  const WHITE = "FFFFFF"
  const totalOpp = (op.palancas || []).reduce((s, p) => s + (p.impacto_venta_incremental_mxn || 0), 0)

  function hdr(slide, title, sub) {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.7, fill: { color: theme.primary } })
    slide.addText(title, { x: 0.3, y: 0.1, w: 11, h: 0.5, fontSize: 15, bold: true, color: WHITE, fontFace: theme.font })
    if (sub) slide.addText(sub, { x: 0.3, y: 0.44, w: 10, h: 0.22, fontSize: 8, color: "CCDDFF", fontFace: theme.font })
    slide.addText("Genomma Lab x " + account.name + " | Confidencial 2024", { x: 0, y: 6.85, w: "100%", h: 0.22, fontSize: 8, color: "AAAAAA", fontFace: theme.font, align: "center" })
  }

  function bar(slide, x, y, w, h, pct, color, label, val) {
    const filled = Math.min(pct / 100, 1) * w
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: "E8E8E8" } })
    if (filled > 0) slide.addShape(pptx.ShapeType.rect, { x, y, w: filled, h, fill: { color } })
    if (label) slide.addText(label, { x: x - 1.7, y: y - 0.02, w: 1.6, h: h + 0.04, fontSize: 9, color: DARK, fontFace: theme.font, align: "right" })
    if (val) slide.addText(val, { x: x + w + 0.05, y: y - 0.02, w: 0.9, h: h + 0.04, fontSize: 9, bold: true, color: PRIM, fontFace: theme.font })
  }

  // SLIDE 1 PORTADA
  const s1 = pptx.addSlide()
  s1.background = { color: theme.primary }
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 4.0, w: "100%", h: 3.2, fill: { color: "000000", transparency: 70 } })
  s1.addText("PLAN COMERCIAL CONJUNTO 2024", { x: 0.5, y: 0.5, w: 12, h: 0.45, fontSize: 11, bold: true, color: WHITE, fontFace: theme.font, charSpacing: 4 })
  s1.addText(op.titulo, { x: 0.5, y: 1.05, w: 12, h: 2.2, fontSize: 26, bold: true, color: WHITE, fontFace: theme.font })
  s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.35, w: 4.0, h: 0.05, fill: { color: WHITE } })
  s1.addText(op.headline_oportunidad, { x: 0.5, y: 3.5, w: 12, h: 0.7, fontSize: 13, color: "DDDDDD", fontFace: theme.font, italic: true })
  s1.addText(account.name + "  x  Genomma Lab  |  Semana 47 - 2024", { x: 0.5, y: 4.3, w: 12, h: 0.4, fontSize: 12, bold: true, color: WHITE, fontFace: theme.font })
  s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.2, w: 3.8, h: 1.1, fill: { color: "FFFFFF", transparency: 88 } })
  s1.addText("Oportunidad Total", { x: 0.6, y: 5.28, w: 3.6, h: 0.3, fontSize: 10, color: "DDDDDD", fontFace: theme.font })
  s1.addText(formatMXN(totalOpp, false) + " MXN", { x: 0.6, y: 5.55, w: 3.6, h: 0.6, fontSize: 22, bold: true, color: WHITE, fontFace: theme.font })

  // SLIDE 2 ESTADO ACTUAL
  const s2 = pptx.addSlide()
  s2.background = { color: "FFFFFF" }
  hdr(s2, "01  Estado Actual del Negocio", "KPIs vs objetivo — cifras en MXN")
  s2.addText(op.resumen_ejecutivo, { x: 0.3, y: 0.8, w: 12.4, h: 0.75, fontSize: 11, color: DARK, fontFace: theme.font, italic: true })
  const semC = { verde: "10B981", amarillo: "F59E0B", rojo: "EF4444" }[op.semaforo_negocio] || "888888"
  s2.addShape(pptx.ShapeType.ellipse, { x: 12.1, y: 0.82, w: 0.5, h: 0.5, fill: { color: semC } })
  const kpis = [
    { l: "Sell-In YTD", v: formatMXN(sellin[account.id].real_acum, true), pct: (sellin[account.id].real_acum / sellin[account.id].objetivo_acum) * 100, sub: "Obj: " + formatMXN(sellin[account.id].objetivo_acum, true) },
    { l: "Sell-In Mes", v: formatMXN(sellin[account.id].real_mes, true), pct: (sellin[account.id].real_mes / sellin[account.id].objetivo_mes) * 100, sub: "Obj: " + formatMXN(sellin[account.id].objetivo_mes, true) },
    { l: "Fondos Ejecutados", v: funds[account.id].execution_pct.toFixed(0) + "%", pct: funds[account.id].execution_pct, sub: formatMXN(funds[account.id].executed_ytd_mxn, true) + " MXN" },
    { l: "Tienda Perfecta", v: tp ? tp.score_general_pct.toFixed(0) + "%" : "N/D", pct: tp ? (tp.score_general_pct / 85) * 100 : 0, sub: "vs objetivo 85%" },
  ]
  kpis.forEach((k, i) => {
    const x = 0.3 + i * 3.2
    const c = k.pct >= 100 ? "10B981" : k.pct >= 80 ? "F59E0B" : "EF4444"
    s2.addShape(pptx.ShapeType.rect, { x, y: 1.68, w: 3.05, h: 1.5, fill: { color: "F8F9FA" }, line: { color: c, width: 2 } })
    s2.addText(k.l, { x: x + 0.1, y: 1.75, w: 2.85, h: 0.28, fontSize: 9, bold: true, color: PRIM, fontFace: theme.font })
    s2.addText(k.v, { x: x + 0.1, y: 2.0, w: 2.85, h: 0.55, fontSize: 20, bold: true, color: DARK, fontFace: theme.font })
    s2.addText(k.sub + "  |  " + k.pct.toFixed(0) + "%", { x: x + 0.1, y: 2.55, w: 2.85, h: 0.22, fontSize: 8, color: GRAY, fontFace: theme.font })
    const bw = 2.85; const fl = Math.min(k.pct / 100, 1) * bw
    s2.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: 2.92, w: bw, h: 0.1, fill: { color: "E0E0E0" } })
    if (fl > 0) s2.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: 2.92, w: fl, h: 0.1, fill: { color: c } })
  })
  s2.addText("Desempeno por Categoria:", { x: 0.3, y: 3.3, w: 12, h: 0.28, fontSize: 11, bold: true, color: DARK, fontFace: theme.font })
  ;(op.estado_por_categoria || []).slice(0, 4).forEach((cat, i) => {
    const x = 0.3 + i * 3.2
    const tc = cat.tendencia_pct >= 0 ? "10B981" : "EF4444"
    s2.addShape(pptx.ShapeType.rect, { x, y: 3.65, w: 3.05, h: 2.8, fill: { color: "F8F9FA" }, line: { color: "E0E0E0", width: 1 } })
    s2.addShape(pptx.ShapeType.rect, { x, y: 3.65, w: 3.05, h: 0.25, fill: { color: theme.primary } })
    s2.addText(cat.categoria, { x: x + 0.08, y: 3.67, w: 2.89, h: 0.21, fontSize: 9, bold: true, color: WHITE, fontFace: theme.font })
    s2.addText((cat.marcas || []).join(", "), { x: x + 0.08, y: 3.96, w: 2.89, h: 0.22, fontSize: 8, color: GRAY, fontFace: theme.font })
    s2.addText(formatMXN(cat.ventas_ytd_mxn || 0, true), { x: x + 0.08, y: 4.2, w: 2.89, h: 0.45, fontSize: 17, bold: true, color: DARK, fontFace: theme.font })
    s2.addText("Venta YTD MXN", { x: x + 0.08, y: 4.65, w: 2.89, h: 0.2, fontSize: 8, color: GRAY, fontFace: theme.font })
    s2.addText((cat.tendencia_pct >= 0 ? "+" : "") + (cat.tendencia_pct || 0).toFixed(1) + "% YoY", { x: x + 0.08, y: 4.88, w: 2.89, h: 0.3, fontSize: 14, bold: true, color: "#" + tc, fontFace: theme.font })
    s2.addText("SOM: " + (cat.market_share_pct || 0).toFixed(1) + "%", { x: x + 0.08, y: 5.2, w: 2.89, h: 0.22, fontSize: 9, color: PRIM, fontFace: theme.font })
    s2.addText(cat.diagnostico || "", { x: x + 0.08, y: 5.44, w: 2.89, h: 0.9, fontSize: 8, color: GRAY, fontFace: theme.font })
  })

  // SLIDE 3 MARKET SHARE
  const s3 = pptx.addSlide()
  s3.background = { color: "FFFFFF" }
  hdr(s3, "02  Market Share — Posicion vs Competencia", "Tendencia semanal por categoria · " + account.name)
  if (ms) {
    Object.entries(ms.categorias).slice(0, 3).forEach(([cat, data], ci) => {
      const yBase = 0.88 + ci * 2.1
      s3.addText(cat, { x: 0.3, y: yBase, w: 9, h: 0.3, fontSize: 12, bold: true, color: DARK, fontFace: theme.font })
      s3.addText("Total cat: " + formatMXN(data.categoria_total_mxn_semana, true) + " MXN/sem", { x: 9.5, y: yBase, w: 3.1, h: 0.3, fontSize: 9, color: GRAY, fontFace: theme.font, align: "right" })
      data.marcas.slice(0, 4).forEach((m, mi) => {
        const y = yBase + 0.36 + mi * 0.4
        const isG = !m.es_competidor
        const bc = isG ? (m.tendencia === "alza" ? "10B981" : m.tendencia === "baja" ? "EF4444" : theme.primary) : "CCCCCC"
        bar(s3, 1.85, y + 0.06, 8.0, 0.26, m.som_pct * 2, bc, m.marca, m.som_pct.toFixed(1) + "%")
        if (isG && m.som_anterior_pct) {
          const d = m.som_pct - m.som_anterior_pct
          s3.addText((d >= 0 ? "+" : "") + d.toFixed(1) + "pts", { x: 11.5, y: y + 0.08, w: 1.0, h: 0.26, fontSize: 9, bold: true, color: d >= 0 ? "10B981" : "EF4444", fontFace: theme.font })
        }
      })
    })
  }

  // SLIDE 4 TIENDA PERFECTA
  const s4 = pptx.addSlide()
  s4.background = { color: "FFFFFF" }
  hdr(s4, "03  Tienda Perfecta — Gaps = Ventas Perdidas", "Cerrar estos gaps genera crecimiento inmediato para ambas partes")
  if (tp) {
    const tpc = tp.score_general_pct >= 80 ? "10B981" : tp.score_general_pct >= 65 ? "F59E0B" : "EF4444"
    s4.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.82, w: 3.2, h: 1.5, fill: { color: "F8F9FA" }, line: { color: tpc, width: 3 } })
    s4.addText("Score TP", { x: 0.4, y: 0.9, w: 3.0, h: 0.3, fontSize: 10, bold: true, color: PRIM, fontFace: theme.font })
    s4.addText(tp.score_general_pct.toFixed(0) + "%", { x: 0.4, y: 1.18, w: 3.0, h: 0.7, fontSize: 38, bold: true, color: "#" + tpc, fontFace: theme.font })
    s4.addText("vs obj 85% | Gap: " + tp.gap_pts.toFixed(1) + "pts", { x: 0.4, y: 1.9, w: 3.0, h: 0.3, fontSize: 8, color: GRAY, fontFace: theme.font })
    s4.addText("Indicadores de ejecucion:", { x: 3.8, y: 0.85, w: 9, h: 0.28, fontSize: 11, bold: true, color: DARK, fontFace: theme.font })
    tp.indicadores.forEach((ind, i) => {
      const y = 1.2 + i * 0.52
      const c = ind.status === "off_track" ? "EF4444" : ind.status === "at_risk" ? "F59E0B" : "10B981"
      bar(s4, 5.8, y + 0.12, 5.8, 0.24, (ind.resultado_pct / ind.objetivo_pct) * 100, c, ind.nombre, ind.resultado_pct.toFixed(0) + "% / " + ind.objetivo_pct + "%")
    })
    if (op.oportunidades_tienda_perfecta && op.oportunidades_tienda_perfecta.length > 0) {
      s4.addText("Oportunidad de ventas al cerrar gaps de Tienda Perfecta:", { x: 0.3, y: 4.45, w: 12, h: 0.28, fontSize: 11, bold: true, color: DARK, fontFace: theme.font })
      op.oportunidades_tienda_perfecta.slice(0, 3).forEach((o, i) => {
        const x = 0.3 + i * 4.3
        s4.addShape(pptx.ShapeType.rect, { x, y: 4.8, w: 4.1, h: 1.65, fill: { color: "FFF8F0" }, line: { color: "F59E0B", width: 2 } })
        s4.addText(o.indicador, { x: x + 0.1, y: 4.87, w: 3.9, h: 0.32, fontSize: 10, bold: true, color: DARK, fontFace: theme.font })
        s4.addText("Gap: " + o.gap_actual_pct.toFixed(0) + "% vs obj " + o.objetivo_pct + "%", { x: x + 0.1, y: 5.2, w: 3.9, h: 0.24, fontSize: 9, color: "EF4444", fontFace: theme.font })
        s4.addText("+" + formatMXN(o.impacto_ventas_mxn || 0, true) + " MXN", { x: x + 0.1, y: 5.45, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: "10B981", fontFace: theme.font })
        s4.addText(o.accion_concreta, { x: x + 0.1, y: 5.82, w: 3.9, h: 0.55, fontSize: 8, color: GRAY, fontFace: theme.font })
      })
    }
    s4.addText("Score TP por marca:", { x: 0.3, y: 6.55, w: 12, h: 0.25, fontSize: 10, bold: true, color: DARK, fontFace: theme.font })
    tp.marcas_detalle.slice(0, 6).forEach((m, i) => {
      const c = m.tp_score_pct >= 80 ? "10B981" : m.tp_score_pct >= 65 ? "F59E0B" : "EF4444"
      s4.addText(m.marca + ": " + m.tp_score_pct.toFixed(0) + "%", { x: 0.3 + i * 2.15, y: 6.8, w: 2.0, h: 0.25, fontSize: 9, bold: true, color: "#" + c, fontFace: theme.font })
    })
  }

  // SLIDE 5 PLAN PALANCAS
  const s5 = pptx.addSlide()
  s5.background = { color: "FFFFFF" }
  hdr(s5, "04  Plan Conjunto — Las 3 Palancas de Crecimiento", "Que pone cada parte · Impacto en ventas incrementales MXN")
  s5.addText("Oportunidad total: " + formatMXN(totalOpp, false) + " MXN en ventas incrementales", { x: 0.3, y: 0.78, w: 12.4, h: 0.32, fontSize: 11, bold: true, color: PRIM, fontFace: theme.font })
  ;(op.palancas || []).slice(0, 3).forEach((p, i) => {
    const y = 1.2 + i * 1.75
    const isF = i === 0
    s5.addShape(pptx.ShapeType.rect, { x: 0.3, y, w: 12.4, h: 1.6, fill: { color: isF ? theme.primary : "F8F9FA" }, line: { color: isF ? theme.primary : "E0E0E0", width: 1 } })
    s5.addShape(pptx.ShapeType.rect, { x: 0.3, y, w: 0.45, h: 1.6, fill: { color: isF ? "FFFFFF" : theme.primary, transparency: isF ? 85 : 0 } })
    s5.addText("#" + p.numero, { x: 0.32, y: y + 0.55, w: 0.41, h: 0.5, fontSize: 15, bold: true, color: isF ? WHITE : WHITE, fontFace: theme.font, align: "center" })
    s5.addText("[" + p.categoria + "] " + p.palanca, { x: 0.88, y: y + 0.04, w: 7.6, h: 0.38, fontSize: 13, bold: true, color: isF ? WHITE : DARK, fontFace: theme.font })
    s5.addText("KBD: " + (p.kbd_que_sustenta || ""), { x: 0.88, y: y + 0.42, w: 7.6, h: 0.24, fontSize: 8.5, color: isF ? "CCDDFF" : PRIM, fontFace: theme.font, italic: true })
    s5.addShape(pptx.ShapeType.rect, { x: 0.88, y: y + 0.7, w: 3.55, h: 0.78, fill: { color: isF ? "FFFFFF" : "E8F4FF", transparency: isF ? 88 : 0 } })
    s5.addText("Genomma pone:", { x: 0.98, y: y + 0.74, w: 3.35, h: 0.22, fontSize: 8, bold: true, color: isF ? WHITE : PRIM, fontFace: theme.font })
    s5.addText(p.que_pone_genomma || "", { x: 0.98, y: y + 0.94, w: 3.35, h: 0.48, fontSize: 8, color: isF ? "DDDDDD" : GRAY, fontFace: theme.font })
    s5.addShape(pptx.ShapeType.rect, { x: 4.55, y: y + 0.7, w: 3.55, h: 0.78, fill: { color: isF ? "FFFFFF" : "FFF0E8", transparency: isF ? 88 : 0 } })
    s5.addText(account.name.split(" ")[0] + " pone:", { x: 4.65, y: y + 0.74, w: 3.35, h: 0.22, fontSize: 8, bold: true, color: isF ? WHITE : "E07000", fontFace: theme.font })
    s5.addText(p.que_pone_el_cliente || "", { x: 4.65, y: y + 0.94, w: 3.35, h: 0.48, fontSize: 8, color: isF ? "DDDDDD" : GRAY, fontFace: theme.font })
    s5.addShape(pptx.ShapeType.rect, { x: 8.6, y, w: 4.1, h: 1.6, fill: { color: isF ? "FFFFFF" : theme.primary, transparency: isF ? 90 : 0 } })
    s5.addText("Venta incremental", { x: 8.7, y: y + 0.1, w: 3.9, h: 0.28, fontSize: 9, color: isF ? WHITE : WHITE, fontFace: theme.font, align: "center" })
    s5.addText(formatMXN(p.impacto_venta_incremental_mxn || 0, false), { x: 8.7, y: y + 0.36, w: 3.9, h: 0.7, fontSize: 22, bold: true, color: isF ? WHITE : WHITE, fontFace: theme.font, align: "center" })
    s5.addText("+" + (p.impacto_som_pts || 0).toFixed(1) + "pts SOM · " + p.plazo, { x: 8.7, y: y + 1.1, w: 3.9, h: 0.35, fontSize: 9, color: isF ? "CCDDFF" : "AACCFF", fontFace: theme.font, align: "center" })
  })

  // SLIDE 6 KBDs
  const s6 = pptx.addSlide()
  s6.background = { color: "FFFFFF" }
  hdr(s6, "05  Como Medimos el Exito — KBDs por Marca", "Inputs comprometidos que generan los outputs acordados")
  s6.addText("Cada palanca tiene un KBD especifico auditado semanalmente. Sin ejecucion de los inputs no se logran los outputs.", { x: 0.3, y: 0.8, w: 12.4, h: 0.3, fontSize: 10, color: GRAY, fontFace: theme.font, italic: true })
  const kbdM = marcas.slice(0, 6).map(m => ({ marca: m.marca, data: kbd[m.marca] })).filter(x => x.data).slice(0, 3)
  const numCols = kbdM.length || 1
  const colW = numCols === 1 ? 12.6 : numCols === 2 ? 6.1 : 4.0
  const colGap = numCols === 1 ? 0 : numCols === 2 ? 6.4 : 4.25
  kbdM.forEach((km, i) => {
    const x = 0.2 + i * colGap
    s6.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: colW, h: 5.6, fill: { color: "F8F9FA" }, line: { color: "E0E0E0", width: 1 } })
    s6.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: colW, h: 0.32, fill: { color: theme.primary } })
    s6.addText(km.marca, { x: x + 0.1, y: 1.22, w: colW - 0.2, h: 0.28, fontSize: 11, bold: true, color: WHITE, fontFace: theme.font })
    s6.addText("Obj: VN " + (km.data.objetivo_venta_neta_pct > 0 ? "+" : "") + km.data.objetivo_venta_neta_pct + "% | SOM +" + km.data.objetivo_som_pts + "pts", { x: x + 0.1, y: 1.56, w: colW - 0.2, h: 0.26, fontSize: 7.5, bold: true, color: PRIM, fontFace: theme.font })
    const maxKbds = numCols === 1 ? 5 : 3
    const kbdH = numCols === 1 ? 1.1 : 1.55
    km.data.kbds.slice(0, maxKbds).forEach((k, ki) => {
      const ky = 1.9 + ki * kbdH
      const c = k.status === "off_track" ? "EF4444" : k.status === "at_risk" ? "F59E0B" : "10B981"
      s6.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: ky, w: colW - 0.2, h: kbdm.length === 1 ? 1.55 : 1.4, fill: { color: k.status === "off_track" ? "FFF0F0" : k.status === "at_risk" ? "FFFBF0" : "F0FFF8" }, line: { color: c, width: 1 } })
      s6.addText("[" + k.area + "] " + k.cumplimiento_pct + "%", { x: x + 0.18, y: ky + 0.06, w: colW - 0.36, h: 0.26, fontSize: 9, bold: true, color: "#" + c, fontFace: theme.font })
      const nc = kbdM.length
      const descLen = nc === 1 ? 160 : 90
      s6.addText(k.descripcion.substring(0, descLen) + (k.descripcion.length > descLen ? "..." : ""), { x: x + 0.18, y: ky + 0.32, w: colW - 0.36, h: nc === 1 ? 0.5 : 0.65, fontSize: nc === 1 ? 8.5 : 7.5, color: GRAY, fontFace: theme.font })
      s6.addText("Output: " + k.impacto, { x: x + 0.18, y: ky + (nc === 1 ? 0.82 : 1.0), w: colW - 0.36, h: 0.24, fontSize: nc === 1 ? 8.5 : 7.5, bold: true, color: PRIM, fontFace: theme.font })
    })
  })

  // SLIDE 7 CIERRE
  const s7 = pptx.addSlide()
  s7.background = { color: theme.primary }
  s7.addShape(pptx.ShapeType.rect, { x: 0, y: 3.5, w: "100%", h: 3.7, fill: { color: "000000", transparency: 75 } })
  s7.addText("06  PROXIMOS PASOS — COMPROMISOS DE LA REUNION", { x: 0.5, y: 0.4, w: 12, h: 0.38, fontSize: 11, bold: true, color: WHITE, fontFace: theme.font, charSpacing: 2 })
  s7.addText(op.compromiso_comprador, { x: 0.5, y: 0.88, w: 12, h: 1.8, fontSize: 19, bold: true, color: WHITE, fontFace: theme.font })
  s7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.75, w: 5.5, h: 0.05, fill: { color: WHITE, transparency: 60 } })
  s7.addText("Oportunidad total del plan:", { x: 0.5, y: 2.9, w: 6, h: 0.32, fontSize: 11, color: "DDDDDD", fontFace: theme.font })
  s7.addText(formatMXN(totalOpp, false) + " MXN", { x: 0.5, y: 3.22, w: 8, h: 0.85, fontSize: 38, bold: true, color: WHITE, fontFace: theme.font })
  s7.addShape(pptx.ShapeType.rect, { x: 0.3, y: 4.55, w: 6.0, h: 2.1, fill: { color: "FFFFFF", transparency: 88 } })
  s7.addText("Genomma se compromete a:", { x: 0.45, y: 4.65, w: 5.7, h: 0.28, fontSize: 10, bold: true, color: WHITE, fontFace: theme.font })
  s7.addText(op.siguiente_paso_genomma.substring(0, 220) + (op.siguiente_paso_genomma.length > 220 ? "..." : ""), { x: 0.45, y: 4.97, w: 5.7, h: 1.55, fontSize: 10, color: "DDDDDD", fontFace: theme.font })
  s7.addShape(pptx.ShapeType.rect, { x: 6.8, y: 4.55, w: 6.0, h: 2.1, fill: { color: "FFFFFF", transparency: 88 } })
  s7.addText(account.name + " confirma:", { x: 6.95, y: 4.65, w: 5.7, h: 0.28, fontSize: 10, bold: true, color: WHITE, fontFace: theme.font })
  s7.addText(op.compromiso_comprador.substring(0, 220) + (op.compromiso_comprador.length > 220 ? "..." : ""), { x: 6.95, y: 4.97, w: 5.7, h: 1.55, fontSize: 10, color: "DDDDDD", fontFace: theme.font })

  pptx.write("arraybuffer").then(ab => {
    const blob = new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })
    const link = document.createElement("a")
    link.href = window.URL.createObjectURL(blob)
    link.setAttribute("download", "Genomma_" + account.name.replace(/ /g,  "_") + "_Plan_Comercial_2024.pptx")
    document.body.appendChild(link)
    link.click()
    link.parentNode.removeChild(link)
  })
}

export default function OnePager({ accountId, onBack }) {
  const account = accounts.find(a => a.id === accountId)
  const marcas = (brandMap[accountId] || []).sort((a, b) => Math.abs(b.gap_ytd) - Math.abs(a.gap_ytd))
  const [loading, setLoading] = useState(false)
  const [onePagerData, setOnePagerData] = useState(null)
  const [generatingPPT, setGeneratingPPT] = useState(false)
  const [error, setError] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const theme = CLIENT_THEMES[accountId] || CLIENT_THEMES.wmt
  const totalOpp = onePagerData ? (onePagerData.palancas || []).reduce((s, p) => s + (p.impacto_venta_incremental_mxn || 0), 0) : 0

  async function handleGenerate() {
    setLoading(true); setError(null); setOnePagerData(null); setConfirmed(false)
    try { setOnePagerData(await generateOnePager(account, marcas)) }
    catch (e) { setError("Error: " + e.message) }
    finally { setLoading(false) }
  }

  async function handlePPT() {
    setGeneratingPPT(true)
    setError(null)
    try {
      await generatePPTX(account, onePagerData, marcas)
    } catch (e) {
      setError("Error PPT: " + e.message)
      alert("Error: " + e.message)
    } finally {
      setGeneratingPPT(false)
    }
  }

  return (
    <div>
      <div className="breadcrumb">
        <a onClick={onBack}>Dashboard</a><span>&#8250;</span>
        <a onClick={onBack}>{account.name}</a><span>&#8250;</span>
        <span>Plan Comercial + PowerPoint</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Plan Comercial para el Comprador</h1>
          <p style={{ fontSize: 13, color: "var(--silver)" }}>KBDs + Market Share + Tienda Perfecta | {account.name}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onePagerData && confirmed && <button className="btn btn-primary" onClick={handlePPT} disabled={generatingPPT} style={{ background: "#" + theme.primary, fontSize: 13 }}>{generatingPPT ? "Generando PPT..." : "Descargar PowerPoint"}</button>}
          {onePagerData && !confirmed && <button className="btn btn-primary" onClick={() => setConfirmed(true)} style={{ background: "#" + theme.primary, fontSize: 13 }}>Confirmar y Generar PowerPoint</button>}
          <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading} style={{ fontSize: 13 }}>{loading ? "Analizando..." : onePagerData ? "Regenerar" : "Generar Plan"}</button>
        </div>
      </div>

      {!onePagerData && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 56, height: 56, background: "#" + theme.primary, borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, fontWeight: 800, color: "white" }}>G</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Plan comercial listo para el comprador</h2>
          <p style={{ fontSize: 13, color: "var(--silver)", marginBottom: 20, maxWidth: 520, margin: "0 auto 20px" }}>Cruza KBDs, Market Share, Tienda Perfecta y sell-out para generar un plan especifico y negociable con el comprador de {account.name}.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, maxWidth: 680, margin: "0 auto 24px" }}>
            {["KBDs por Marca", "Market Share vs Comp.", "Tienda Perfecta", "Sell-Out + Sell-In"].map((item, i) => (
              <div key={i} style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--obsidian)" }}>{item}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} style={{ fontSize: 14, padding: "11px 32px", background: "#" + theme.primary }}>Generar Plan Comercial con IA</button>
          {error && <div className="alert alert-red" style={{ marginTop: 16, textAlign: "left" }}><span>!</span><span>{error}</span></div>}
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="loading-pulse">
            <div className="pulse-dots"><div className="pulse-dot" /><div className="pulse-dot" /><div className="pulse-dot" /></div>
            <span>Analizando KBDs, Market Share y Tienda Perfecta de {account.name}...</span>
          </div>
        </div>
      )}

      {onePagerData && !loading && (
        <div>
          {confirmed && <div className="alert alert-green" style={{ marginBottom: 16 }}><span>OK</span><span>Plan confirmado. Descarga el PowerPoint para presentar al comprador de {account.name}.</span></div>}
          <div style={{ background: "#" + theme.primary, borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 16, color: "white" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Plan Comercial | {account.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{onePagerData.titulo}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 10 }}>{onePagerData.resumen_ejecutivo}</div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: onePagerData.semaforo_negocio === "verde" ? "#10B981" : onePagerData.semaforo_negocio === "amarillo" ? "#F59E0B" : "#EF4444" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "white", textTransform: "uppercase" }}>{onePagerData.semaforo_negocio === "verde" ? "Negocio Saludable" : onePagerData.semaforo_negocio === "amarillo" ? "Requiere Atencion" : "Accion Urgente"}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: "white", fontFamily: "var(--font-mono)" }}>Oportunidad: {formatMXN(totalOpp, false)} MXN</span>
            </div>
          </div>

          {onePagerData.estado_por_categoria && onePagerData.estado_por_categoria.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>Estado por Categoria</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {onePagerData.estado_por_categoria.map((cat, i) => (
                  <div key={i} style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px 12px", borderLeft: "3px solid #" + theme.primary }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#" + theme.primary, textTransform: "uppercase", marginBottom: 4 }}>{cat.categoria}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-mono)", marginBottom: 2 }}>{formatMXN(cat.ventas_ytd_mxn || 0, true)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: cat.tendencia_pct >= 0 ? "var(--success)" : "var(--critical)", marginBottom: 4 }}>{cat.tendencia_pct >= 0 ? "+" : ""}{(cat.tendencia_pct || 0).toFixed(1)}% YoY</div>
                    <div style={{ fontSize: 10, color: "var(--silver)" }}>{cat.diagnostico}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="section-title" style={{ marginBottom: 12 }}>Las 3 Palancas del Plan</div>
              {(onePagerData.palancas || []).map((p, i) => (
                <div key={i} style={{ background: i === 0 ? "#" + theme.primary : "var(--pearl)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--silver)", textTransform: "uppercase", marginBottom: 3 }}>{p.categoria}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "rgba(255,255,255,0.25)" : "#" + theme.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white", flexShrink: 0 }}>{p.numero}</div>
                      <span style={{ fontWeight: 800, fontSize: 13, color: i === 0 ? "white" : "var(--obsidian)" }}>{p.palanca}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? "white" : "#" + theme.primary, fontFamily: "var(--font-mono)" }}>{formatMXN(p.impacto_venta_incremental_mxn || 0, true)} MXN</span>
                  </div>
                  <div style={{ fontSize: 11, color: i === 0 ? "rgba(255,255,255,0.8)" : "var(--silver)", marginBottom: 6 }}>KBD: {p.kbd_que_sustenta}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                    <div style={{ background: i === 0 ? "rgba(255,255,255,0.15)" : "var(--primary-wash)", borderRadius: 4, padding: "4px 8px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--primary)" }}>Genomma pone:</div>
                      <div style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.9)" : "var(--obsidian)" }}>{p.que_pone_genomma}</div>
                    </div>
                    <div style={{ background: i === 0 ? "rgba(255,255,255,0.15)" : "#FFF3E0", borderRadius: 4, padding: "4px 8px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? "rgba(255,255,255,0.7)" : "#E07000" }}>{account.name.split(" ")[0]} pone:</div>
                      <div style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.9)" : "var(--obsidian)" }}>{p.que_pone_el_cliente}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {(p.marcas_impactadas || []).map(m => <span key={m} style={{ fontSize: 10, background: i === 0 ? "rgba(255,255,255,0.2)" : "var(--primary-wash)", color: i === 0 ? "white" : "var(--primary)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{m}</span>)}
                    <span style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.6)" : "var(--silver)", marginLeft: "auto" }}>{p.plazo}</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {onePagerData.oportunidades_tienda_perfecta && onePagerData.oportunidades_tienda_perfecta.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Oportunidades Tienda Perfecta</div>
                  {onePagerData.oportunidades_tienda_perfecta.map((op, i) => (
                    <div key={i} style={{ background: "#FFF8F0", borderRadius: "var(--radius-md)", padding: "8px 12px", marginBottom: 8, borderLeft: "3px solid var(--warning)" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{op.indicador}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: "var(--critical)" }}>Gap: {op.gap_actual_pct.toFixed(0)}% vs {op.objetivo_pct}%</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", fontFamily: "var(--font-mono)" }}>+{formatMXN(op.impacto_ventas_mxn || 0, true)} MXN</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--silver)" }}>{op.accion_concreta}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Compromisos de la Reunion</div>
                <div style={{ background: "var(--success-light)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 10, border: "1px solid var(--success)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", marginBottom: 4 }}>Genomma se compromete a:</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>{onePagerData.siguiente_paso_genomma}</div>
                </div>
                <div style={{ background: "var(--primary-wash)", borderRadius: "var(--radius-md)", padding: "10px 14px", border: "1px solid var(--primary)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", marginBottom: 4 }}>{account.name} confirma:</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{onePagerData.compromiso_comprador}</div>
                </div>
              </div>
            </div>
          </div>

          {!confirmed && (
            <div style={{ padding: "16px 20px", background: "var(--pearl)", borderRadius: "var(--radius-lg)", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>El plan esta correcto o tienes ajustes antes de generar el PowerPoint?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={() => setConfirmed(true)} style={{ fontSize: 13, background: "#" + theme.primary }}>Confirmar y generar PowerPoint para {account.name}</button>
                <button className="btn btn-secondary" onClick={handleGenerate} style={{ fontSize: 13 }}>Regenerar plan</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}