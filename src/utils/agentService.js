const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function callClaude(systemPrompt, userPrompt) {
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
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `API error ${res.status}`) }
  const data = await res.json()
  return data.content[0].text
}

const SYSTEM_KAM = `Eres el Agente KAM de Genomma Lab, experto en cuentas clave de consumo masivo en Mexico. Analizas datos de cuentas y generas recomendaciones comerciales accionables. Respondes en espanol, tono ejecutivo, directo y cuantificado. Sin disclaimers.

REGLAS DE OPERACION DEL KAM:
- El KAM opera con autonomia, sentido de urgencia y criterio de negocio. No necesita pedir permiso para actuar.
- Debe buscar siempre maximizar el retorno de la inversion e invertir en los KPIs que realmente mueven el negocio (distribucion, disponibilidad, precio, exhibicion).
- Recomienda acciones directas y concretas. No seas tibio ni generico.

POLITICA COMERCIAL DE GENOMMA — NUNCA VIOLAR:
- NUNCA recomendar promociones 2x1, 3x2 ni buy-one-get-one. Genomma no hace ese tipo de actividades.
- Descuento maximo permitido: 25% sobre precio regular.
- Mecanica permitida: "2 por precio punta" con descuento maximo de 30%.
- Las palancas comerciales de Genomma son: distribucion numerica, disponibilidad en anaquel, exhibicion adicional (cabecera, isla, display), precio punta con descuento controlado, material POP, y activacion digital en portales de retailers.

PROYECCIONES REALISTAS:
- NUNCA proyectar crecimientos de 20-30% por una sola activacion. La elasticidad precio en consumo masivo es limitada.
- Si una marca lleva semanas con descuento y no ha revertido la caida, no asumas que mas descuento va a funcionar. Recomienda revisar la causa raiz: distribucion, disponibilidad, competencia, o cambio en habitos del consumidor.
- Basa tus proyecciones en datos historicos reales. Si el YoY es -21%, una recuperacion realista con activacion seria reducir la caida a -10% o -5%, no revertirla a +20%.
- Cuando no tengas datos suficientes para proyectar, dilo: "Se requiere analisis de elasticidad para proyectar impacto."

CUANDO ESCALAR A DIRECTOR COMERCIAL:
Solo escalar cuando se cumplan estas condiciones juntas:
1. La caida es severa Y la marca es grande (top 5 del portafolio en esa cuenta)
2. Y ya no hay fondos comerciales disponibles para revertir la tendencia
3. O cuando el bruto a neto real esta excediendo significativamente el presupuesto G60 en esa marca
En todos los demas casos, el KAM actua con lo que tiene.

OWNERS: KAM (ejecuta directo), Director Comercial (solo para fondos incrementales o alertas de bruto a neto), Trade Marketing (ejecucion PDV, materiales, planogramas). NUNCA asignes acciones a Rodrigo ni a Marco.`

export async function generateWeeklyActions(account, selloutData, inventoryData, fundsData, marketData) {
  const inv = inventoryData[account.id].skus
  const funds = fundsData[account.id]
  const sellout = selloutData[account.id]
  const market = marketData[account.id] || null
  const context = {
    cuenta: account.name,
    sellout_ultima_semana: Object.fromEntries(Object.entries(sellout.skus).map(([sku, weeks]) => [sku, weeks[weeks.length - 1]])),
    sellout_semana_anterior: Object.fromEntries(Object.entries(sellout.skus).map(([sku, weeks]) => [sku, weeks[weeks.length - 2]])),
    inventario: inv,
    fondos: { comprometido: funds.annual_committed_mxn, ejecutado: funds.executed_ytd_mxn, pct: funds.execution_pct, pendientes: funds.activities.filter(a => a.status === "pendiente") },
    senales: market ? { ticker: market.ticker, variacion: market.change_pct, highlights: market.last_earnings.key_highlights } : null,
  }
  const prompt = `Analiza los datos de ${account.name} y genera el analisis semanal.\n\nDATOS:\n${JSON.stringify(context, null, 2)}\n\nResponde SOLO en JSON sin texto adicional:\n{"resumen_ejecutivo":"2-3 oraciones del estado","actions":[{"priority":1,"type":"inventory|funds|growth|risk","title":"titulo corto","description":"descripcion con datos especificos","impact":"impacto cuantificado","owner":"KAM|Director Comercial|Trade Marketing","urgency":"alta|media|baja"},{"priority":2,"type":"...","title":"...","description":"...","impact":"...","owner":"...","urgency":"..."},{"priority":3,"type":"...","title":"...","description":"...","impact":"...","owner":"...","urgency":"..."}],"optimal_order":{"justification":"razon ejecutiva","sku_orders":[{"sku":"nombre","current_coverage_days":0,"suggested_units":0,"suggested_value_mxn":0,"priority":"urgente|programada|opcional","justification":"razon"}],"total_value_mxn":0,"delivery_window":"plazo"}}`
  const raw = await callClaude(SYSTEM_KAM, prompt)
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(clean)
}

export async function analyzeMarketSignal(account, marketData) {
  const market = marketData[account.id]
  if (!market) return null
  const prompt = `Analiza las senales financieras de ${account.name} (${market.ticker}) y su impacto para Genomma Lab.\n\nDATOS: Precio $${market.price_mxn} (${market.change_pct}%), Revenue +${market.last_earnings.revenue_growth_yoy}% YoY, EBITDA ${market.last_earnings.ebitda_margin_pct}%, SSS ${market.last_earnings.same_store_sales_growth}%\nHighlights: ${market.last_earnings.key_highlights.join("; ")}\n\nGenera analisis estrategico de 3 parrafos para el KAM: (1) que significa para la relacion con Genomma, (2) acciones proximas 2 semanas, (3) oportunidades o riesgos para marcas Genomma.`
  return await callClaude(SYSTEM_KAM, prompt)
}

export async function chatWithAgent(account, selloutData, inventoryData, fundsData, userMessage, history) {
  const inv = inventoryData[account.id].skus
  const funds = fundsData[account.id]
  const sellout = selloutData[account.id]
  const systemWithContext = `${SYSTEM_KAM}\n\nCUENTA ACTIVA: ${account.name}\nSell-out ultima semana: ${JSON.stringify(Object.fromEntries(Object.entries(sellout.skus).map(([k, v]) => [k, v[v.length - 1]])))}\nCobertura dias: ${JSON.stringify(Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, v.coverage_days])))}\nFondos: ${funds.execution_pct}% ejecutado de $${(funds.annual_committed_mxn/1000000).toFixed(1)}M`
  const messages = [...history.map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }]
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1000, system: systemWithContext, messages }),
  })
  if (!res.ok) throw new Error("Error calling agent")
  const data = await res.json()
  return data.content[0].text
}
