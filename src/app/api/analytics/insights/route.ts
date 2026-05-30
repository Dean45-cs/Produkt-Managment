export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress } from '@/lib/delivery'

/**
 * Umfangreiche Analyse-Kennzahlen für das Geschäft (Konsignationsmodell).
 * Aggregiert serverseitig alles, was für Entscheidungen nützlich ist:
 * KPIs, Monatstrends, ABC-Analyse, Bestands-/Kategorie-/Standortauswertung,
 * Ladenhüter, Nachbestellungen, offene Forderungen, Margenverteilung.
 */
export async function GET() {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const since90 = new Date(now.getTime() - 90 * DAY)

  const [products, settlements, deliveries, returns, inventory] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, inventory: true },
    }),
    prisma.settlement.findMany({
      include: { items: { include: { product: { include: { category: true } } } } },
      orderBy: { settledAt: 'asc' },
    }),
    prisma.delivery.findMany({
      include: {
        items: { include: { product: true } },
        settlements: { include: { items: true } },
        returns: { include: { items: true } },
      },
    }),
    prisma.return.findMany({ include: { items: true } }),
    prisma.inventory.findMany({ include: { product: { include: { category: true } }, location: true } }),
  ])

  // ---------- Grund-Aggregate aus Abrechnungen ----------
  let totalRevenue = 0
  let totalCost = 0
  let unitsSold = 0
  const monthMap = new Map<string, { revenue: number; cost: number; units: number; settlements: number }>()
  const productAgg = new Map<string, { id: string; name: string; sku: string; revenue: number; cost: number; units: number; categoryName: string | null }>()
  const categoryAgg = new Map<string, { name: string; revenue: number; cost: number; units: number }>()

  for (const s of settlements) {
    const key = `${s.settledAt.getFullYear()}-${String(s.settledAt.getMonth() + 1).padStart(2, '0')}`
    const m = monthMap.get(key) ?? { revenue: 0, cost: 0, units: 0, settlements: 0 }
    m.settlements += 1
    for (const it of s.items) {
      const price = it.product?.purchasePriceCt ?? 0
      const cost = it.quantitySold * price
      totalRevenue += it.totalAmountCt
      totalCost += cost
      unitsSold += it.quantitySold
      m.revenue += it.totalAmountCt
      m.cost += cost
      m.units += it.quantitySold

      const pid = it.productId
      const pa = productAgg.get(pid) ?? {
        id: pid,
        name: it.product?.name ?? '—',
        sku: it.product?.sku ?? '',
        revenue: 0, cost: 0, units: 0,
        categoryName: it.product?.category?.name ?? null,
      }
      pa.revenue += it.totalAmountCt
      pa.cost += cost
      pa.units += it.quantitySold
      productAgg.set(pid, pa)

      const cname = it.product?.category?.name ?? 'Ohne Kategorie'
      const ca = categoryAgg.get(cname) ?? { name: cname, revenue: 0, cost: 0, units: 0 }
      ca.revenue += it.totalAmountCt
      ca.cost += cost
      ca.units += it.quantitySold
      categoryAgg.set(cname, ca)
    }
    monthMap.set(key, m)
  }

  const totalProfit = totalRevenue - totalCost
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  const settlementCount = settlements.length
  const avgOrderValueCt = settlementCount > 0 ? Math.round(totalRevenue / settlementCount) : 0

  // ---------- Monatstrend inkl. kumuliert + Wachstum ----------
  const months = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
  let cumRevenue = 0
  let cumProfit = 0
  const monthly = months.map(([period, d]) => {
    const profit = d.revenue - d.cost
    cumRevenue += d.revenue
    cumProfit += profit
    return {
      period,
      revenue: d.revenue,
      cost: d.cost,
      profit,
      units: d.units,
      settlements: d.settlements,
      marginPct: d.revenue > 0 ? (profit / d.revenue) * 100 : 0,
      cumRevenue,
      cumProfit,
    }
  })
  const lastMonth = monthly[monthly.length - 1]
  const prevMonth = monthly[monthly.length - 2]
  const momGrowthPct = lastMonth && prevMonth && prevMonth.revenue > 0
    ? ((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
    : null
  const bestMonth = monthly.length ? [...monthly].sort((a, b) => b.revenue - a.revenue)[0] : null
  const worstMonth = monthly.length ? [...monthly].sort((a, b) => a.revenue - b.revenue)[0] : null

  // ---------- Lieferungen: Mengen + offene Forderungen ----------
  let unitsDelivered = 0
  let openReceivablesCt = 0
  let openUnits = 0
  for (const d of deliveries) {
    if (d.status === 'CANCELLED' || d.status === 'PENDING') continue
    for (const it of d.items) unitsDelivered += it.quantitySent
    const prog = deliveryProgress(d)
    for (const p of prog.perProduct) {
      if (p.quantityOpen <= 0) continue
      openUnits += p.quantityOpen
      // Wert der offenen Ware: erwarteter Preis aus der Lieferposition, sonst Ø-Verkaufspreis.
      const di = d.items.find((x) => x.productId === p.productId)
      const sold = productAgg.get(p.productId)
      const avgSale = sold && sold.units > 0 ? Math.round(sold.revenue / sold.units) : 0
      const unitPrice = di?.expectedPriceCt ?? avgSale
      openReceivablesCt += p.quantityOpen * unitPrice
    }
  }
  const sellThroughPct = unitsDelivered > 0 ? (unitsSold / unitsDelivered) * 100 : 0

  // ---------- Retouren ----------
  let returnUnits = 0
  for (const r of returns) for (const it of r.items) returnUnits += it.quantityReturned
  const returnRatePct = unitsDelivered > 0 ? (returnUnits / unitsDelivered) * 100 : 0

  // ---------- Bestand: Wert/Einheiten gesamt, je Kategorie, je Standort ----------
  let inventoryValueCt = 0
  let inventoryUnits = 0
  const invByCategory = new Map<string, { name: string; value: number; units: number }>()
  const invByLocation = new Map<string, { name: string; value: number; units: number }>()
  for (const inv of inventory) {
    const price = inv.product?.purchasePriceCt ?? 0
    const value = inv.quantity * price
    inventoryValueCt += value
    inventoryUnits += inv.quantity
    const cname = inv.product?.category?.name ?? 'Ohne Kategorie'
    const c = invByCategory.get(cname) ?? { name: cname, value: 0, units: 0 }
    c.value += value; c.units += inv.quantity; invByCategory.set(cname, c)
    const lname = inv.location?.name ?? '—'
    const l = invByLocation.get(lname) ?? { name: lname, value: 0, units: 0 }
    l.value += value; l.units += inv.quantity; invByLocation.set(lname, l)
  }

  // ---------- Bestand je Produkt + zuletzt verkauft ----------
  const stockByProduct = new Map<string, number>()
  for (const inv of inventory) stockByProduct.set(inv.productId, (stockByProduct.get(inv.productId) ?? 0) + inv.quantity)
  const lastSoldByProduct = new Map<string, Date>()
  for (const s of settlements) for (const it of s.items) {
    const prev = lastSoldByProduct.get(it.productId)
    if (!prev || s.settledAt > prev) lastSoldByProduct.set(it.productId, s.settledAt)
  }

  // ---------- Ladenhüter (Bestand, aber seit 90 Tagen / nie verkauft) ----------
  const deadStock = products
    .map((p) => {
      const stock = stockByProduct.get(p.id) ?? 0
      const last = lastSoldByProduct.get(p.id) ?? null
      return {
        id: p.id, name: p.name, sku: p.sku,
        stock,
        valueCt: stock * p.purchasePriceCt,
        lastSold: last,
        daysSinceSold: last ? Math.floor((now.getTime() - last.getTime()) / DAY) : null,
      }
    })
    .filter((p) => p.stock > 0 && (!p.lastSold || p.lastSold < since90))
    .sort((a, b) => b.valueCt - a.valueCt)
  const deadStockValueCt = deadStock.reduce((s, p) => s + p.valueCt, 0)

  // ---------- Nachbestellungen ----------
  const reorderList = products
    .map((p) => ({
      id: p.id, name: p.name, sku: p.sku,
      stock: stockByProduct.get(p.id) ?? 0,
      reorderPoint: p.reorderPoint,
      reorderQty: p.reorderQty,
    }))
    .filter((p) => p.stock <= p.reorderPoint && p.reorderPoint > 0)
    .sort((a, b) => a.stock - b.stock)

  // ---------- ABC-Analyse (Pareto nach Umsatz) ----------
  const productsSorted = Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue)
  let running = 0
  const abc = productsSorted.map((p) => {
    running += p.revenue
    const cumPct = totalRevenue > 0 ? (running / totalRevenue) * 100 : 0
    const profit = p.revenue - p.cost
    return {
      id: p.id, name: p.name, sku: p.sku,
      categoryName: p.categoryName,
      revenue: p.revenue,
      profit,
      units: p.units,
      marginPct: p.revenue > 0 ? (profit / p.revenue) * 100 : 0,
      revenueSharePct: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      cumSharePct: cumPct,
      class: cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C',
    }
  })
  const abcSummary = ['A', 'B', 'C'].map((cls) => {
    const group = abc.filter((p) => p.class === cls)
    return {
      class: cls,
      productCount: group.length,
      revenue: group.reduce((s, p) => s + p.revenue, 0),
      revenueSharePct: totalRevenue > 0 ? (group.reduce((s, p) => s + p.revenue, 0) / totalRevenue) * 100 : 0,
    }
  })

  // ---------- Kategorie-Performance ----------
  const categories = Array.from(categoryAgg.values())
    .map((c) => {
      const profit = c.revenue - c.cost
      return { name: c.name, revenue: c.revenue, profit, units: c.units, marginPct: c.revenue > 0 ? (profit / c.revenue) * 100 : 0 }
    })
    .sort((a, b) => b.revenue - a.revenue)

  // ---------- Margenverteilung der verkauften Produkte ----------
  const marginBuckets = [
    { label: '< 0 %', min: -Infinity, max: 0, count: 0 },
    { label: '0–20 %', min: 0, max: 20, count: 0 },
    { label: '20–40 %', min: 20, max: 40, count: 0 },
    { label: '40–60 %', min: 40, max: 60, count: 0 },
    { label: '> 60 %', min: 60, max: Infinity, count: 0 },
  ]
  for (const p of abc) {
    const b = marginBuckets.find((b) => p.marginPct >= b.min && p.marginPct < b.max)
    if (b) b.count += 1
  }

  return NextResponse.json({
    kpis: {
      totalRevenueCt: totalRevenue,
      totalCostCt: totalCost,
      totalProfitCt: totalProfit,
      avgMarginPct: avgMargin,
      unitsSold,
      settlementCount,
      avgOrderValueCt,
      deliveryCount: deliveries.length,
      unitsDelivered,
      sellThroughPct,
      returnUnits,
      returnRatePct,
      inventoryValueCt,
      inventoryUnits,
      openReceivablesCt,
      openUnits,
      deadStockValueCt,
      deadStockCount: deadStock.length,
      reorderCount: reorderList.length,
      momGrowthPct,
      activeProducts: products.length,
      soldProducts: productAgg.size,
    },
    bestMonth,
    worstMonth,
    monthly,
    abc,
    abcSummary,
    categories,
    invByCategory: Array.from(invByCategory.values()).sort((a, b) => b.value - a.value),
    invByLocation: Array.from(invByLocation.values()).sort((a, b) => b.value - a.value),
    deadStock: deadStock.slice(0, 50),
    reorderList: reorderList.slice(0, 50),
    marginBuckets: marginBuckets.map((b) => ({ label: b.label, count: b.count })),
  })
}
