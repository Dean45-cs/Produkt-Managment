export function avgPriceCents(totalAmountCt: number, quantitySold: number): number {
  if (quantitySold === 0) return 0
  return Math.round(totalAmountCt / quantitySold)
}

export function calcProfit(
  totalAmountCt: number,
  quantitySold: number,
  purchasePriceCt: number
): { revenue: number; cost: number; profit: number; marginPct: number } {
  const cost = quantitySold * purchasePriceCt
  const profit = totalAmountCt - cost
  const marginPct = totalAmountCt > 0 ? (profit / totalAmountCt) * 100 : 0
  return { revenue: totalAmountCt, cost, profit, marginPct }
}

export interface MonthlyPoint {
  period: string
  quantity: number
  revenue: number
}

export function forecast(history: MonthlyPoint[], periods = 3): MonthlyPoint[] {
  if (history.length < 2) return []

  const n = history.length
  const xs = history.map((_, i) => i)
  const yQty = history.map(d => d.quantity)
  const yRev = history.map(d => d.revenue)

  function linReg(ys: number[]): { slope: number; intercept: number } {
    const sumX = xs.reduce((s, x) => s + x, 0)
    const sumY = ys.reduce((s, y) => s + y, 0)
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
    const sumX2 = xs.reduce((s, x) => s + x * x, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2)
    const intercept = (sumY - slope * sumX) / n
    return { slope, intercept }
  }

  const qtyReg = linReg(yQty)
  const revReg = linReg(yRev)

  const result: MonthlyPoint[] = []
  const lastPeriod = history[history.length - 1].period

  for (let i = 1; i <= periods; i++) {
    const [year, month] = lastPeriod.split('-').map(Number)
    const nextDate = new Date(year, month - 1 + i, 1)
    const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    const qty = Math.max(0, Math.round(qtyReg.slope * (n + i - 1) + qtyReg.intercept))
    const rev = Math.max(0, Math.round(revReg.slope * (n + i - 1) + revReg.intercept))
    result.push({ period: nextPeriod, quantity: qty, revenue: rev })
  }
  return result
}
