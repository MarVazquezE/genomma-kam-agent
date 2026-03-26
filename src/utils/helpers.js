export function formatMXN(value, compact = false) {
  if (compact) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  }
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function formatPct(value, decimals = 1) { return `${value.toFixed(decimals)}%` }

export function getAccountHealth(accountId, inventory, funds) {
  const inv = inventory[accountId]
  const fund = funds[accountId]
  const skus = Object.values(inv.skus).filter(s => s.coverage_days > 0)
  const avgCoverage = skus.reduce((a, b) => a + b.coverage_days, 0) / skus.length
  const criticalSkus = skus.filter(s => s.coverage_days < 7).length
  const fundExec = fund.execution_pct
  if (criticalSkus > 0 || fundExec < 50) return "red"
  if (avgCoverage < 14 || fundExec < 70) return "amber"
  return "green"
}

export function getHealthLabel(health) {
  return { green: "En orden", amber: "Atención", red: "Riesgo" }[health] || "N/A"
}

export function getLastWeekSellout(sellout, accountId) {
  const data = sellout[accountId]
  return Object.values(data.skus).reduce((total, weeks) => total + weeks[weeks.length - 1], 0)
}

export function getPrevWeekSellout(sellout, accountId) {
  const data = sellout[accountId]
  return Object.values(data.skus).reduce((total, weeks) => total + weeks[weeks.length - 2], 0)
}

export function getWeeklyTotals(sellout, accountId) {
  const data = sellout[accountId]
  return data.weeks.map((week, i) => ({
    week,
    total: Object.values(data.skus).reduce((sum, arr) => sum + arr[i], 0),
  }))
}

export function getAvgCoverage(inventory, accountId) {
  const inv = inventory[accountId]
  const skus = Object.values(inv.skus).filter(s => s.coverage_days > 0)
  return skus.reduce((a, b) => a + b.coverage_days, 0) / skus.length
}

export function getCriticalSkus(inventory, accountId) {
  const inv = inventory[accountId]
  return Object.entries(inv.skus).filter(([, data]) => data.coverage_days > 0 && data.coverage_days < 7).map(([name]) => name)
}
