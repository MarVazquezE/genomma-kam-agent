import fs from "fs"
const base = "C:/Users/mvazqueze/Documents/genomma-kam-agent"

const code = `import { useState } from "react"
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
  wmt: { primary: "0071CE", accent: "FFFFFF", bg: "F0F6FF", name: "Walmart Mexico", font: "Arial" },
  ched: { primary: "CC1720", accent: "FFFFFF", bg: "FFF0F0", name: "Chedraui", font: "Arial" },
  sor: { primary: "003A7A", accent: "FFFFFF", bg: "F0F4FF", name: "Soriana", font: "Arial" },
  oxxo: { primary: "CC1A22", accent: "FFFFFF", bg: "FFF0F0", name: "OXXO", font: "Arial" },
  ahorro: { primary: "007A3D", accent: "FFFFFF", bg: "F0FFF6", name: "Farmacias del Ahorro", font: "Arial" },
  costco: { primary: "004A8F", accent: "FFFFFF", bg: "F0F4FF", name: "Costco Mexico", font: "Arial" },
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
    market_share_por_categoria: ms ? Object.entries(ms.categorias).map(([cat, d]) => ({
      categoria: cat,
      marcas_genomma: d.marcas.filter(m => !m.es_competidor).map(m => ({ marca: m.marca, som: m.som_pct, vs_anterior: m.som_anterior_pct, tendencia: m.tendencia, competidor: m.competidor, competidor_som: m.competidor_som_pct }))
    })) : [],
    kbds_criticos: kbdRelevante.flatMap(m => m.kbds.filter(k => k.status === "off_track").map(k => ({ marca: m.marca, area: k.area, cumplimiento: k.cumplimiento_pct, impacto: k.impacto }))),
    categorias_con_marcas: Object.entries(cats).map(([cat, data]) => ({
      categoria: cat,
      descripcion: data.descripcion,
      palancas_disponibles: data.palancas,
      marcas: data.marcas_cuenta.map(m => ({
        marca: m.marca, tendencia_yoy_pct: m.sell_out_trend, venta_ytd_mxn: m.venta_ytd,
        gap_ytd_mxn: m.gap_ytd, dias_inventario: m.inventario_dias, market_share_pct: m.market_share, clasificacion: m.categoria
      }))
    })),
    reglas_importantes: brandContext.reglas_recomendacion
  }

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
      max_tokens: 3000,
      system: \`Eres un consultor comercial senior de consumo masivo en Mexico experto en negociaciones con compradores de autoservicio.
Generas planes comerciales que los KAMs usan para negociar con compradores de Walmart, Chedraui, Soriana, OXXO y Farmacias.
REGLAS CRITICAS:
- NUNCA mezcles estrategias entre categorias distintas. Cada categoria tiene sus propias palancas.
- Las recomendaciones deben ser especificas, accionables y cuantificadas en MXN.
- El tono es de socio comercial, no de proveedor. Habla de crecimiento conjunto.
- Enfoca en lo que el comprador gana: rotacion, margen, satisfaccion del shopper, market share de categoria.
- Cada palanca debe tener un KBD especifico que la sustenta.\`,
      messages: [{
        role: "user",
        content: \`Genera un plan comercial ejecutivo para presentar al comprador de \${account.name}.

DATOS COMPLETOS:
\${JSON.stringify(context, null, 2)}

Responde SOLO en este JSON:
{
  "titulo": "titulo ejecutivo impactante para el comprador con cifra de oportunidad en MXN",
  "headline_oportunidad": "1 oracion que resume la oportunidad total para el comprador en MXN",
  "resumen_ejecutivo": "3 oraciones con estado actual cuantificado, enfocado en lo que el comprador gana",
  "semaforo_negocio": "verde|amarillo|rojo",
  "estado_por_categoria": [
    {
      "categoria": "nombre categoria",
      "marcas": ["lista"],
      "ventas_ytd_mxn": 0,
      "gap_ytd_mxn": 0,
      "tendencia_pct": 0,
      "market_share_pct": 0,
      "vs_competidor_pts": 0,
      "diagnostico": "1 oracion con el diagnostico especifico de esta categoria"
    }
  ],
  "oportunidades_tienda_perfecta": [
    {
      "indicador": "nombre del gap de TP",
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
      "que_pone_genomma": "inversion, actividad, material, descuento que pone Genomma",
      "que_pone_el_cliente": "anaquel, exhibicion, precio, activacion que pone el comprador",
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
}\`
      }]
    })
  })

  const data = await res.json()
  const raw = data.content[0].text.replace(/\`\`\`json\\n?/g, "").replace(/\`\`\`\\n?/g, "").trim()
  return JSON.parse(raw)
}

async function generatePPTX(account, onePagerData, marcas) {
  const theme = CLIENT_THEMES[account.id] || CLIENT_THEMES.wmt
  const ms = marketShare[account.id]
  const tp = tiendaPerfecta[account.id]
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_WIDE"
  pptx.author = "Genomma Lab - KAM Agent"

  const PRIM = "#" + theme.primary
  const DARK = "#1A1A2E"
  const GRAY = "#555555"
  const LIGHT = "#F8F8F8"
  const WHITE = "FFFFFF"
  const totalOpp = (onePagerData.palancas || []).reduce((s, p) => s + (p.impacto_venta_incremental_mxn || 0), 0)

  function makeHeader(slide, title, sub) {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.7, fill: { color: theme.primary } })
    slide.addText(title, { x: 0.3, y: 0.1, w: 11, h: 0.5, fontSize: 16, bold: true, color: WHITE, fontFace: theme.font })
    if (sub) slide.addText(sub, { x: 0.3, y: 0.42, w: 10, h: 0.25, fontSize: 9, color: "CCDDFF", fontFace: theme.font })
    slide.addText("Genomma Lab x " + account.name + " | Confidencial 2024", { x: 0, y: 6.85, w: "100%", h: 0.25, fontSize: 8, color: "AAAAAA", fontFace: theme.font, align: "center" })
  }

  function drawBar(slide, x, y, w, h, pct, color, label, value) {
    const filled = Math.min(pct / 100, 1) * w
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: "E8E8E8" } })
    if (filled > 0) slide.addShape(pptx.ShapeType.rect, { x, y, w: filled, h, fill: { color } })
    if (label) slide.addText(label, { x: x - 1.6, y: y - 0.02, w: 1.55, h: h + 0.04, fontSize: 9, color: DARK, fontFace: theme.font, align: "right" })
    if (value) slide.addText(value, { x: x + w + 0.05, y: y - 0.02, w: 0.8, h: h + 0.04, fontSize: 9, bold: true, color: "#" + theme.primary, fontFace: theme.font })
  }

  // SLIDE 1 - PORTADA
  const s1 = pptx.addSlide()
  s1.background = { color: theme.primary }
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 4.2, w: "100%", h: 3.0, fill: { color: "000000", transparency: 70 } })
  s1.addText("PLAN COMERCIAL CONJUNTO 2024", { x: 0.5, y: 0.5, w: 12, h: 0.5, fontSize: 11, bold: true, color: WHITE, fontFace: theme.font, charSpacing: 4 })
  s1.addText(onePagerData.titulo, { x: 0.5, y: 1.1, w: 12, h: 2.4, fontSize: 28, bold: true, color: WHITE, fontFace: theme.font })
  s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.6, w: 4.0, h: 0.06, fill: { color: WHITE } })
  s1.addText(onePagerData.headline_oportunidad, { x: 0.5, y: 3.8, w: 12, h: 0.8, fontSize: 14, color: "DDDDDD", fontFace: theme.font, italic: true })
  s1.addText(account.name + "  x  Genomma Lab  |  Semana 47 - 2024", { x: 0.5, y: 4.5, w: 12, h: 0.4, fontSize: 12, bold: true, color: WHITE, fontFace: theme.font })
  s1.addText("Confidencial - Solo para uso interno del comprador", { x: 0.5, y: 4.95, w: 12, h: 0.35, fontSize: 10, color: "AAAAAA", fontFace: theme.font })
  s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.6, w: 3.5, h: 1.0, fill: { color: "FFFFFF", transparency: 85 } })
  s1.addText("Oportunidad Total", { x: 0.6, y: 5.65, w: 3.3, h: 0.35, fontSize: 10, color: "DDDDDD", fontFace: theme.font })
  s1.addText(formatMXN(totalOpp, false) + " MXN", { x: 0.6, y: 5.98, w: 3.3, h: 0.5, fontSize: 20, bold: true, color: WHITE, fontFace: theme.font })

  // SLIDE 2 - ESTADO ACTUAL DEL NEGOCIO
  const s2 = pptx.addSlide()
  s2.background = { color: "FFFFFF" }
  makeHeader(s2, "01  Estado Actual del Negocio", "KPIs consolidados vs objetivo — cifras en MXN")

  s2.addText(onePagerData.resumen_ejecutivo, { x: 0.3, y: 0.82, w: 12.4, h: 0.8, fontSize: 11, color: DARK, fontFace: theme.font, italic: true })

  const semC = { verde: "10B981", amarillo: "F59E0B", rojo: "EF4444" }[onePagerData.semaforo_negocio] || "888888"
  s2.addShape(pptx.ShapeType.ellipse, { x: 12.1, y: 0.82, w: 0.55, h: 0.55, fill: { color: semC } })

  const kpis = [
    { l: "Sell-In YTD", v: formatMXN(sellin[account.id].real_acum, true), obj: formatMXN(sellin[account.id].objetivo_acum, true), pct: (sellin[account.id].real_acum / sellin[account.id].objetivo_acum) * 100, vsly: sellin[account.id].vs_anterior_acum },
    { l: "Sell-In Mes", v: formatMXN(sellin[account.id].real_mes, true), obj: formatMXN(sellin[account.id].objetivo_mes, true), pct: (sellin[account.id].real_mes / sellin[account.id].objetivo_mes) * 100, vsly: sellin[account.id].vs_anterior_mes },
    { l: "Fondos Ejecutados", v: funds[account.id].execution_pct.toFixed(0) + "%", obj: "100%", pct: funds[account.id].execution_pct, vsly: 0 },
    { l: "Tienda Perfecta", v: tp ? tp.score_general_pct.toFixed(0) + "%" : "N/D", obj: "85%", pct: tp ? (tp.score_general_pct / 85) * 100 : 0, vsly: tp ? tp.gap_pts : 0 },
  ]
  kpis.forEach((k, i) => {
    const x = 0.3 + i * 3.2
    const isGood = k.pct >= 100
    const c = isGood ? "10B981" : k.pct >= 80 ? "F59E0B" : "EF4444"
    s2.addShape(pptx.ShapeType.rect, { x, y: 1.75, w: 3.05, h: 1.5, fill: { color: "F8F9FA" }, line: { color: c, width: 2 } })
    s2.addText(k.l, { x: x + 0.1, y: 1.82, w: 2.85, h: 0.3, fontSize: 9, bold: true, color: "#" + theme.primary, fontFace: theme.font })
    s2.addText(k.v, { x: x + 0.1, y: 2.1, w: 2.85, h: 0.55, fontSize: 20, bold: true, color: DARK, fontFace: theme.font })
    s2.addText("Obj: " + k.obj + "  |  " + k.pct.toFixed(0) + "% cumplimiento", { x: x + 0.1, y: 2.65, w: 2.85, h: 0.25, fontSize: 8, color: GRAY, fontFace: theme.font })
    const barW = 2.85
    const filled = Math.min(k.pct / 100, 1) * barW
    s2.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: 3.0, w: barW, h: 0.12, fill: { color: "E0E0E0" } })
    if (filled > 0) s2.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: 3.0, w: filled, h: 0.12, fill: { color: c } })
    const lyLabel = k.vsly !== 0 ? (k.vsly > 0 ? "+" : "") + k.vsly.toFixed(1) + "% vs LY" : ""
    if (lyLabel) s2.addText(lyLabel, { x: x + 0.1, y: 3.15, w: 2.85, h: 0.22, fontSize: 8, bold: true, color: k.vsly >= 0 ? "10B981" : "EF4444", fontFace: theme.font })
  })

  s2.addText("Desempeno por Categoria", { x: 0.3, y: 3.55, w: 12, h: 0.3, fontSize: 11, bold: true, color: DARK, fontFace: theme.font })
  const cats = onePagerData.estado_por_categoria || []
  cats.slice(0, 4).forEach((cat, i) => {
    const x = 0.3 + i * 3.2
    const tColor = cat.tendencia_pct >= 0 ? "10B981" : "EF4444"
    s2.addShape(pptx.ShapeType.rect, { x, y: 3.9, w: 3.05, h: 2.5, fill: { color: "F8F9FA" }, line: { color: "E0E0E0", width: 1 } })
    s2.addShape(pptx.ShapeType.rect, { x, y: 3.9, w: 3.05, h: 0.25, fill: { color: theme.primary } })
    s2.addText(cat.categoria, { x: x + 0.08, y: 3.92, w: 2.89, h: 0.21, fontSize: 9, bold: true, color: WHITE, fontFace: theme.font })
    s2.addText(cat.marcas.join(", "), { x: x + 0.08, y: 4.2, w: 2.89, h: 0.22, fontSize: 8, color: GRAY, fontFace: theme.font })
    s2.addText(formatMXN(cat.ventas_ytd_mxn || 0, true), { x: x + 0.08, y: 4.45, w: 2.89, h: 0.4, fontSize: 16, bold: true, color: DARK, fontFace: theme.font })
    s2.addText("Venta YTD MXN", { x: x + 0.08, y: 4.85, w: 2.89, h: 0.22, fontSize: 8, color: GRAY, fontFace: theme.font })
    s2.addText((cat.tendencia_pct >= 0 ? "+" : "") + (cat.tendencia_pct || 0).toFixed(1) + "% YoY", { x: x + 0.08, y: 5.08, w: 2.89, h: 0.28, fontSize: 13, bold: true, color: tColor, fontFace: theme.font })
    s2.addText("SOM: " + (cat.market_share_pct || 0).toFixed(1) + "%", { x: x + 0.08, y: 5.38, w: 2.89, h: 0.22, fontSize: 9, color: "#" + theme.primary, fontFace: theme.font })
    s2.addText(cat.diagnostico || "", { x: x + 0.08, y: 5.62, w: 2.89, h: 0.7, fontSize: 8, color: GRAY, fontFace: theme.font })
  })

  // SLIDE 3 - MARKET SHARE
  const s3 = pptx.addSlide()
  s3.background = { color: "FFFFFF" }
  makeHeader(s3, "02  Market Share — Posicion Genomma vs Competencia", "Por categoria · " + account.name + " · Sem 47")

  if (ms) {
    const cats3 = Object.entries(ms.categorias).slice(0, 3)
    cats3.forEach(([cat, data], ci) => {
      const yBase = 0.9 + ci * 2.1
      s3.addText(cat, { x: 0.3, y: yBase, w: 12, h: 0.3, fontSize: 12, bold: true, color: DARK, fontFace: theme.font })
      s3.addText("Total categoria: " + formatMXN(data.categoria_total_mxn_semana, true) + " MXN/sem", { x: 9.5, y: yBase, w: 3.1, h: 0.3, fontSize: 9, color: GRAY, fontFace: theme.font, align: "right" })
      data.marcas.slice(0, 4).forEach((m, mi) => {
        const y = yBase + 0.38 + mi * 0.38
        const isGeomma = !m.es_competidor
        const barColor = isGeomma ? (m.tendencia === "alza" ? "10B981" : m.tendencia === "baja" ? "EF4444" : theme.primary) : "CCCCCC"
        drawBar(s3, 1.8, y + 0.04, 8.5, 0.28, m.som_pct * 2, barColor, m.marca, m.som_pct.toFixed(1) + "%")
        if (isGeomma && m.som_anterior_pct) {
          const diff = m.som_pct - m.som_anterior_pct
          s3.addText((diff >= 0 ? "+" : "") + diff.toFixed(1) + "pts", { x: 10.5, y: y + 0.06, w: 1.0, h: 0.28, fontSize: 9, bold: true, color: diff >= 0 ? "10B981" : "EF4444", fontFace: theme.font })
        }
      })
    })
  } else {
    s3.addText("No hay datos de market share disponibles para esta cuenta.", { x: 0.3, y: 2.0, w: 12, h: 0.5, fontSize: 13, color: GRAY, fontFace: theme.font })
  }

  // SLIDE 4 - TIENDA PERFECTA
  const s4 = pptx.addSlide()
  s4.background = { color: "FFFFFF" }
  makeHeader(s4, "03  Tienda Perfecta — Oportunidad de Ejecucion", "Gaps por indicador = ventas perdidas para ambos")

  if (tp) {
    const tpColor = tp.score_general_pct >= 80 ? "10B981" : tp.score_general_pct >= 65 ? "F59E0B" : "EF4444"
    s4.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.82, w: 3.5, h: 1.6, fill: { color: "F8F9FA" }, line: { color: tpColor, width: 3 } })
    s4.addText("Score General", { x: 0.4, y: 0.9, w: 3.3, h: 0.35, fontSize: 10, bold: true, color: "#" + theme.primary, fontFace: theme.font })
    s4.addText(tp.score_general_pct.toFixed(0) + "%", { x: 0.4, y: 1.22, w: 3.3, h: 0.7, fontSize: 36, bold: true, color: "#" + tpColor, fontFace: theme.font })
    s4.addText("vs objetivo 85%  |  Gap: " + tp.gap_pts.toFixed(1) + "pts", { x: 0.4, y: 1.93, w: 3.3, h: 0.28, fontSize: 9, color: GRAY, fontFace: theme.font })
    s4.addText("Por indicador de ejecucion:", { x: 4.2, y: 0.85, w: 8.5, h: 0.3, fontSize: 11, bold: true, color: DARK, fontFace: theme.font })
    tp.indicadores.forEach((ind, i) => {
      const y = 1.22 + i * 0.55
      const c = ind.status === "off_track" ? "EF4444" : ind.status === "at_risk" ? "F59E0B" : "10B981"
      drawBar(s4, 6.0, y + 0.12, 5.5, 0.26, (ind.resultado_pct / ind.objetivo_pct) * 100, c, ind.nombre, ind.resultado_pct.toFixed(0) + "% / " + ind.objetivo_pct + "%")
    })

    if (onePagerData.oportunidades_tienda_perfecta && onePagerData.oportunidades_tienda_perfecta.length > 0) {
      s4.addText("Impacto en ventas de cerrar los gaps de Tienda Perfecta:", { x: 0.3, y: 4.52, w: 12, h: 0.3, fontSize: 11, bold: true, color: DARK, fontFace: theme.font })
      onePagerData.oportunidades_tienda_perfecta.slice(0, 3).forEach((op, i) => {
        const x = 0.3 + i * 4.3
        s4.addShape(pptx.ShapeType.rect, { x, y: 4.88, w: 4.1, h: 1.6, fill: { color: "FFF8F0" }, line: { color: "F59E0B", width: 2 } })
        s4.addText(op.indicador, { x: x + 0.1, y: 4.95, w: 3.9, h: 0.35, fontSize: 10, bold: true, color: DARK, fontFace: theme.font })
        s4.addText("Gap: " + op.gap_actual_pct.toFixed(0) + "% vs obj " + op.objetivo_pct + "%", { x: x + 0.1, y: 5.3, w: 3.9, h: 0.25, fontSize: 9, color: "EF4444", fontFace: theme.font })
        s4.addText("+" + formatMXN(op.impacto_ventas_mxn || 0, true) + " MXN", { x: x + 0.1, y: 5.55, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: "10B981", fontFace: theme.font })
        s4.addText(op.accion_concreta, { x: x + 0.1, y: 5.9, w: 3.9, h: 0.5, fontSize: 8, color: GRAY, fontFace: theme.font })
      })
    }

    if (tp.marcas_detalle.length > 0) {
      s4.addText("Score TP por marca:", { x: 0.3, y: 6.55, w: 12, h: 0.25, fontSize: 10, bold: true, color: DARK, fontFace: theme.font })
      tp.marcas_detalle.slice(0, 5).forEach((m, i) => {
        const x = 0.3 + i * 2.55
        const c = m.tp_score_pct >= 80 ? "10B981" : m.tp_score_pct >= 65 ? "F59E0B" : "EF4444"
        s4.addText(m.marca + ": " + m.tp_score_pct.toFixed(0) + "%", { x, y: 6.8, w: 2.4, h: 0.25, fontSize: 9, bold: true, color: "#" + c, fontFace: theme.font })
      })
    }
  } else {
    s4.addText("No hay datos de Tienda Perfecta para esta cuenta.", { x: 0.3, y: 2.0, w: 12, h: 0.5, fontSize: 13, color: GRAY, fontFace: theme.font })
  }

  // SLIDE 5 - PLAN CONCRETO (PALANCAS)
  const s5 = pptx.addSlide()
  s5.background = { color: "FFFFFF" }
  makeHeader(s5, "04  Plan Conjunto — Las 3 Palancas de Crecimiento", "Que pone cada parte · Impacto en ventas incrementales MXN")

  s5.addText("Oportunidad total: " + formatMXN(totalOpp, false) + " MXN en ventas incrementales", { x: 0.3, y: 0.8, w: 12, h: 0.35, fontSize: 12, bold: true, color: "#" + theme.primary, fontFace: theme.font })
  ;(onePagerData.palancas || []).forEach((p, i) => {
    const y = 1.3 + i * 1.75
    const isFirst = i === 0
    s5.addShape(pptx.ShapeType.rect, { x: 0.3, y, w: 12.4, h: 1.6, fill: { color: isFirst ? theme.primary : "F8F9FA" }, line: { color: isFirst ? theme.primary : "E0E0E0", width: 1 } })
    s5.addShape(pptx.ShapeType.rect, { x: 0.3, y, w: 0.5, h: 1.6, fill: { color: isFirst ? "FFFFFF" : theme.primary, transparency: isFirst ? 80 : 0 } })
    s5.addText("#" + p.numero, { x: 0.32, y: y + 0.55, w: 0.46, h: 0.5, fontSize: 16, bold: true, color: isFirst ? WHITE : WHITE, fontFace: theme.font, align: "center" })
    s5.addText("[" + p.categoria + "] " + p.palanca, { x: 0.95, y: y + 0.05, w: 7.5, h: 0.4, fontSize: 13, bold: true, color: isFirst ? WHITE : DARK, fontFace: theme.font })
    s5.addText("KBD: " + (p.kbd_que_sustenta || ""), { x: 0.95, y: y + 0.42, w: 7.5, h: 0.25, fontSize: 9, color: isFirst ? "CCDDFF" : "#" + theme.primary, fontFace: theme.font, italic: true })
    s5.addShape(pptx.ShapeType.rect, { x: 0.95, y: y + 0.72, w: 3.6, h: 0.75, fill: { color: isFirst ? "FFFFFF" : "E8F4FF", transparency: isFirst ? 85 : 0 } })
    s5.addText("Genomma pone:", { x: 1.05, y: y + 0.75, w: 3.4, h: 0.22, fontSize: 8, bold: true, color: isFirst ? WHITE : "#" + theme.primary, fontFace: theme.font })
    s5.addText(p.que_pone_genomma || "", { x: 1.05, y: y + 0.95, w: 3.4, h: 0.45, fontSize: 8, color: isFirst ? "DDDDDD" : GRAY, fontFace: theme.font })
    s5.addShape(pptx.ShapeType.rect, { x: 4.65, y: y + 0.72, w: 3.6, h: 0.75, fill: { color: isFirst ? "FFFFFF" : "FFF0E8", transparency: isFirst ? 85 : 0 } })
    s5.addText(account.name.split(" ")[0] + " pone:", { x: 4.75, y: y + 0.75, w: 3.4, h: 0.22, fontSize: 8, bold: true, color: isFirst ? WHITE : "E07000", fontFace: theme.font })
    s5.addText(p.que_pone_el_cliente || "", { x: 4.75, y: y + 0.95, w: 3.4, h: 0.45, fontSize: 8, color: isFirst ? "DDDDDD" : GRAY, fontFace: theme.font })
    s5.addShape(pptx.ShapeType.rect, { x: 8.7, y, w: 4.0, h: 1.6, fill: { color: isFirst ? "FFFFFF" : theme.primary, transparency: isFirst ? 90 : 0 } })
    s5.addText("Venta incremental", { x: 8.8, y: y + 0.1, w: 3.8, h: 0.3, fontSize: 9, color: isFirst ? WHITE : WHITE, fontFace: theme.font, align: "center" })
    s5.addText(formatMXN(p.impacto_venta_incremental_mxn || 0, false), { x: 8.8, y: y + 0.38, w: 3.8, h: 0.7, fontSize: 22, bold: true, color: isFirst ? WHITE : WHITE, fontFace: theme.font, align: "center" })
    s5.addText("+" + (p.impacto_som_pts || 0).toFixed(1) + " pts SOM · " + p.plazo, { x: 8.8, y: y + 1.1, w: 3.8, h: 0.35, fontSize: 9, color: isFirst ? "CCDDFF" : "AACCFF", fontFace: theme.font, align: "center" })
  })

  // SLIDE 6 - KBDs Y METRICAS DE EXITO
  const s6 = pptx.addSlide()
  s6.background = { color: "FFFFFF" }
  makeHeader(s6, "05  Como Medimos el Exito — KBDs y Metricas de Seguimiento", "Inputs que generan los outputs acordados")

  s6.addText("Metodologia: cada palanca tiene un KBD especifico que garantiza el resultado.", { x: 0.3, y: 0.82, w: 12, h: 0.3, fontSize: 11, color: GRAY, fontFace: theme.font, italic: true })

  const kbdMarcas = marcas.slice(0, 3).map(m => ({ marca: m.marca, data: kbd[m.marca] })).filter(x => x.data)
  kbdMarcas.forEach((km, i) => {
    const x = 0.3 + i * 4.3
    s6.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: 4.1, h: 5.4, fill: { color: "F8F9FA" }, line: { color: "E0E0E0", width: 1 } })
    s6.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: 4.1, h: 0.35, fill: { color: theme.primary } })
    s6.addText(km.marca, { x: x + 0.1, y: 1.23, w: 3.9, h: 0.29, fontSize: 11, bold: true, color: WHITE, fontFace: theme.font })
    s6.addText("Objetivo: Venta Neta " + (km.data.objetivo_venta_neta_pct > 0 ? "+" : "") + km.data.objetivo_venta_neta_pct + "% | SOM +" + km.data.objetivo_som_pts + "pts", { x: x + 0.1, y: 1.6, w: 3.9, h: 0.28, fontSize: 8, bold: true, color: "#" + theme.primary, fontFace: theme.font })
    km.data.kbds.slice(0, 5).forEach((k, ki) => {
      const ky = 1.95 + ki * 0.88
      const c = k.status === "off_track" ? "EF4444" : k.status === "at_risk" ? "F59E0B" : "10B981"
      s6.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: ky, w: 3.9, h: 0.82, fill: { color: k.status === "off_track" ? "FFF0F0" : k.status === "at_risk" ? "FFFBF0" : "F0FFF8" }, line: { color: c, width: 1 } })
      s6.addText("[" + k.area + "] " + k.cumplimiento_pct + "%", { x: x + 0.18, y: ky + 0.05, w: 3.7, h: 0.25, fontSize: 9, bold: true, color: "#" + c, fontFace: theme.font })
      s6.addText(k.descripcion.substring(0, 70) + (k.descripcion.length > 70 ? "..." : ""), { x: x + 0.18, y: ky + 0.28, w: 3.7, h: 0.3, fontSize: 7.5, color: GRAY, fontFace: theme.font })
      s6.addText("Output: " + k.impacto, { x: x + 0.18, y: ky + 0.58, w: 3.7, h: 0.2, fontSize: 7.5, bold: true, color: "#" + theme.primary, fontFace: theme.font })
    })
  })

  // SLIDE 7 - CIERRE Y COMPROMISOS
  const s7 = pptx.addSlide()
  s7.background = { color: theme.primary }
  s7.addShape(pptx.ShapeType.rect, { x: 0, y: 3.6, w: "100%", h: 3.6, fill: { color: "000000", transparency: 75 } })
  s7.addText("06  PROXIMOS PASOS Y COMPROMISOS", { x: 0.5, y: 0.4, w: 12, h: 0.4, fontSize: 11, bold: true, color: WHITE, fontFace: theme.font, charSpacing: 3 })
  s7.addText(onePagerData.compromiso_comprador, { x: 0.5, y: 0.95, w: 12, h: 1.8, fontSize: 20, bold: true, color: WHITE, fontFace: theme.font })
  s7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.85, w: 6.0, h: 0.06, fill: { color: WHITE, transparency: 60 } })
  s7.addText("Oportunidad total del plan:", { x: 0.5, y: 3.0, w: 6, h: 0.35, fontSize: 12, color: "DDDDDD", fontFace: theme.font })
  s7.addText(formatMXN(totalOpp, false) + " MXN", { x: 0.5, y: 3.35, w: 8, h: 0.9, fontSize: 40, bold: true, color: WHITE, fontFace: theme.font })

  s7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.4, w: 5.5, h: 1.9, fill: { color: "FFFFFF", transparency: 90 } })
  s7.addText("Genomma se compromete a:", { x: 0.6, y: 4.5, w: 5.3, h: 0.3, fontSize: 10, bold: true, color: WHITE, fontFace: theme.font })
  s7.addText(onePagerData.siguiente_paso_genomma, { x: 0.6, y: 4.82, w: 5.3, h: 1.35, fontSize: 11, color: "DDDDDD", fontFace: theme.font })

  s7.addShape(pptx.ShapeType.rect, { x: 6.8, y: 4.4, w: 5.5, h: 1.9, fill: { color: "FFFFFF", transparency: 90 } })
  s7.addText(account.name + " confirma:", { x: 6.9, y: 4.5, w: 5.3, h: 0.3, fontSize: 10, bold: true, color: WHITE, fontFace: theme.font })
  s7.addText(onePagerData.compromiso_comprador, { x: 6.9, y: 4.82, w: 5.3, h: 1.35, fontSize: 11, color: "DDDDDD", fontFace: theme.font })

  s7.addText("Genomma Lab | " + account.name + " | Confidencial | 2024", { x: 0, y: 6.8, w: "100%", h: 0.25, fontSize: 9, color: "888888", fontFace: theme.font, align: "center" })

  const filename = "Genomma_" + account.name.replace(/ /g, "_") + "_Plan_Comercial_2024.pptx"
  await pptx.writeFile({ fileName: filename })
  return filename
}

export default function OnePager({ accountId, onBack }) {
  const account = accounts.find(a => a.id === accountId)
  const marcas = (brandMap[accountId] || []).sort((a, b) => Math.abs(b.gap_ytd) - Math.abs(a.gap_ytd))
  const [loading, setLoading] = useState(false)
  const [onePagerData, setOnePagerData] = useState(null)
  const [generatingPPT, setGeneratingPPT] = useState(false)
  const [error, setError] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [editNotes, setEditNotes] = useState("")
  const theme = CLIENT_THEMES[accountId] || CLIENT_THEMES.wmt

  const urgColor = { alta: "var(--critical)", media: "var(--warning)", baja: "var(--success)" }

  async function handleGenerate() {
    setLoading(true); setError(null); setOnePagerData(null); setConfirmed(false); setEditNotes("")
    try {
      const data = await generateOnePager(account, marcas)
      setOnePagerData(data)
    } catch (e) { setError("Error al generar: " + e.message) }
    finally { setLoading(false) }
  }

  async function handleGeneratePPT() {
    setGeneratingPPT(true)
    try { await generatePPTX(account, onePagerData, marcas) }
    catch (e) { setError("Error al generar PowerPoint: " + e.message) }
    finally { setGeneratingPPT(false) }
  }

  const totalOpp = onePagerData ? (onePagerData.palancas || []).reduce((s, p) => s + (p.impacto_venta_incremental_mxn || 0), 0) : 0

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
          <p style={{ fontSize: 13, color: "var(--silver)" }}>Analisis cruzado con KBDs, Market Share y Tienda Perfecta | {account.name}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onePagerData && confirmed && (
            <button className="btn btn-primary" onClick={handleGeneratePPT} disabled={generatingPPT} style={{ background: "#" + theme.primary, fontSize: 13 }}>
              {generatingPPT ? "Generando PPT..." : "Descargar PowerPoint"}
            </button>
          )}
          {onePagerData && !confirmed && (
            <button className="btn btn-primary" onClick={() => setConfirmed(true)} style={{ background: "#" + theme.primary, fontSize: 13 }}>
              Confirmar y Generar PowerPoint
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading} style={{ fontSize: 13 }}>
            {loading ? "Analizando..." : onePagerData ? "Regenerar" : "Generar Plan"}
          </button>
        </div>
      </div>

      {!onePagerData && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 56, height: 56, background: "#" + theme.primary, borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, fontWeight: 800, color: "white" }}>G</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Plan comercial listo para el comprador</h2>
          <p style={{ fontSize: 13, color: "var(--silver)", marginBottom: 20, maxWidth: 520, margin: "0 auto 20px" }}>
            El agente cruzara sell-out, sell-in, market share, Tienda Perfecta y KBDs para generar un plan especifico con acciones concretas para negociar con el comprador de {account.name}.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, maxWidth: 680, margin: "0 auto 24px" }}>
            {["Sell-Out + Sell-In", "Market Share vs Comp.", "Tienda Perfecta", "KBDs por Marca"].map((item, i) => (
              <div key={i} style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--obsidian)" }}>{item}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} style={{ fontSize: 14, padding: "11px 32px", background: "#" + theme.primary }}>
            Generar Plan Comercial con IA
          </button>
          {error && <div className="alert alert-red" style={{ marginTop: 16, textAlign: "left" }}><span>!</span><span>{error}</span></div>}
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="loading-pulse">
            <div className="pulse-dots"><div className="pulse-dot" /><div className="pulse-dot" /><div className="pulse-dot" /></div>
            <span>Analizando KBDs, Market Share, Tienda Perfecta y oportunidades de {account.name}...</span>
            <span style={{ fontSize: 11, color: "var(--silver)" }}>Generando plan concreto para el comprador</span>
          </div>
        </div>
      )}

      {onePagerData && !loading && (
        <div>
          {confirmed && (
            <div className="alert alert-green" style={{ marginBottom: 16 }}>
              <span>OK</span><span>Plan confirmado. Descarga el PowerPoint listo para presentar al comprador de {account.name}.</span>
            </div>
          )}

          <div style={{ background: "#" + theme.primary, borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 16, color: "white" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Plan Comercial | {account.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{onePagerData.titulo}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 10 }}>{onePagerData.resumen_ejecutivo}</div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: onePagerData.semaforo_negocio === "verde" ? "#10B981" : onePagerData.semaforo_negocio === "amarillo" ? "#F59E0B" : "#EF4444" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "white", textTransform: "uppercase" }}>
                  {onePagerData.semaforo_negocio === "verde" ? "Negocio Saludable" : onePagerData.semaforo_negocio === "amarillo" ? "Requiere Atencion" : "Accion Urgente"}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "white", fontFamily: "var(--font-mono)" }}>
                Oportunidad: {formatMXN(totalOpp, false)} MXN
              </div>
            </div>
          </div>

          {onePagerData.estado_por_categoria && onePagerData.estado_por_categoria.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>Estado por Categoria</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {onePagerData.estado_por_categoria.map((cat, i) => {
                  const tColor = cat.tendencia_pct >= 0 ? "var(--success)" : "var(--critical)"
                  return (
                    <div key={i} style={{ background: "var(--pearl)", borderRadius: "var(--radius-md)", padding: "10px 12px", borderLeft: "3px solid #" + theme.primary }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#" + theme.primary, textTransform: "uppercase", marginBottom: 4 }}>{cat.categoria}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-mono)", marginBottom: 2 }}>{formatMXN(cat.ventas_ytd_mxn || 0, true)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: tColor, marginBottom: 4 }}>{cat.tendencia_pct >= 0 ? "+" : ""}{(cat.tendencia_pct || 0).toFixed(1)}% YoY</div>
                      <div style={{ fontSize: 10, color: "var(--silver)" }}>{cat.diagnostico}</div>
                    </div>
                  )
                })}
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div style={{ background: i === 0 ? "rgba(255,255,255,0.15)" : "var(--primary-wash)", borderRadius: 4, padding: "4px 8px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--primary)" }}>Genomma pone:</div>
                      <div style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.9)" : "var(--obsidian)" }}>{p.que_pone_genomma}</div>
                    </div>
                    <div style={{ background: i === 0 ? "rgba(255,255,255,0.15)" : "#FFF3E0", borderRadius: 4, padding: "4px 8px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? "rgba(255,255,255,0.7)" : "#E07000" }}>{account.name.split(" ")[0]} pone:</div>
                      <div style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.9)" : "var(--obsidian)" }}>{p.que_pone_el_cliente}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                    {(p.marcas_impactadas || []).map(m => <span key={m} style={{ fontSize: 10, background: i === 0 ? "rgba(255,255,255,0.2)" : "var(--primary-wash)", color: i === 0 ? "white" : "var(--primary)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{m}</span>)}
                    <span style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.6)" : "var(--silver)", marginLeft: "auto" }}>{p.plazo}</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {onePagerData.oportunidades_tienda_perfecta && onePagerData.oportunidades_tienda_perfecta.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Oportunidades de Tienda Perfecta</div>
                  {onePagerData.oportunidades_tienda_perfecta.map((op, i) => (
                    <div key={i} style={{ background: "#FFF8F0", borderRadius: "var(--radius-md)", padding: "8px 12px", marginBottom: 8, borderLeft: "3px solid var(--warning)" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{op.indicador}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: "var(--critical)" }}>Gap: {op.gap_actual_pct.toFixed(0)}% vs {op.objetivo_pct}% objetivo</span>
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
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>El plan esta correcto o tienes ajustes antes de generar el PowerPoint?</div>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Escribe aqui cualquier ajuste o nota adicional para el KAM..." style={{ width: "100%", height: 60, padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid #E2E8F0", fontSize: 12, resize: "vertical", marginBottom: 10, fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={() => setConfirmed(true)} style={{ fontSize: 13, background: "#" + theme.primary }}>
                  Confirmar y generar PowerPoint para {account.name}
                </button>
                <button className="btn btn-secondary" onClick={handleGenerate} style={{ fontSize: 13 }}>
                  Regenerar plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}`

fs.writeFileSync(base + "/src/pages/OnePager.jsx", code, "utf8")
console.log("OnePager v3 estrategico OK - " + code.split("\\n").length + " lineas")