export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Produkt-Analyse: Aggregiert je Produkt Umsatz, Kosten, Gewinn, Marge,
 * verkaufte Menge, Ø-Verkaufspreis, aktuellen Bestand und die
 * durchschnittliche Kundenbewertung (Sterne).
 */
export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      inventory: true,
      settlementItems: {
        include: {
          settlement: {
            include: { delivery: { include: { supplier: true } } },
          },
        },
      },
      reviews: true,
    },
  })

  const result = products.map((p) => {
    const revenue = p.settlementItems.reduce((s, i) => s + i.totalAmountCt, 0)
    const quantity = p.settlementItems.reduce((s, i) => s + i.quantitySold, 0)
    const cost = quantity * p.purchasePriceCt
    const profit = revenue - cost
    const stock = p.inventory.reduce((s, i) => s + i.quantity, 0)

    const ratingCount = p.reviews.length
    const ratingAvg = ratingCount > 0 ? p.reviews.reduce((s, r) => s + r.rating, 0) / ratingCount : 0

    const settledDates = p.settlementItems.map((i) => i.settlement.settledAt)
    const lastSold = settledDates.length > 0
      ? settledDates.reduce((latest, d) => (d > latest ? d : latest))
      : null

    const supplierMap = new Map<string, { id: string; name: string; revenue: number; cost: number; units: number }>()
    for (const si of p.settlementItems) {
      const sup = si.settlement.delivery?.supplier
      if (!sup) continue
      const agg = supplierMap.get(sup.id) ?? { id: sup.id, name: sup.name, revenue: 0, cost: 0, units: 0 }
      agg.revenue += si.totalAmountCt
      agg.cost += si.quantitySold * p.purchasePriceCt
      agg.units += si.quantitySold
      supplierMap.set(sup.id, agg)
    }
    const supplierBreakdown = Array.from(supplierMap.values()).map((s) => {
      const prof = s.revenue - s.cost
      return {
        supplierId: s.id,
        supplierName: s.name,
        revenue: s.revenue,
        cost: s.cost,
        profit: prof,
        units: s.units,
        avgPriceCt: s.units > 0 ? Math.round(s.revenue / s.units) : 0,
        marginPct: s.revenue > 0 ? (prof / s.revenue) * 100 : 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      imageUrl: p.imageUrl,
      category: p.category ? { name: p.category.name, color: p.category.color } : null,
      purchasePriceCt: p.purchasePriceCt,
      revenue,
      cost,
      profit,
      quantity,
      avgPriceCt: quantity > 0 ? Math.round(revenue / quantity) : 0,
      marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
      stock,
      settlementCount: new Set(p.settlementItems.map((i) => i.settlementId)).size,
      ratingAvg,
      ratingCount,
      lastSold,
      supplierBreakdown,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json(result)
}
