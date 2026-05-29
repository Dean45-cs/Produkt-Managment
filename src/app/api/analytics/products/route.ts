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
      settlementItems: { include: { settlement: true } },
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
    }
  }).sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json(result)
}
