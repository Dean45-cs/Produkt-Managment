export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Lieferanten-/Distributoren-Vergleich: Aggregiert alle Abrechnungspositionen
 * je Lieferant. Zeigt, welcher Distributor die höheren Durchschnittspreise zahlt,
 * inkl. Produktvielfalt, Anzahl Lieferungen und letzter Abrechnung.
 */
export async function GET() {
  const settlements = await prisma.settlement.findMany({
    include: {
      delivery: { include: { supplier: true } },
      items: { include: { product: true } },
    },
  })

  // Anzahl aller (auch offener) Lieferungen je Lieferant
  const deliveryCounts = await prisma.delivery.groupBy({
    by: ['supplierId'],
    _count: { _all: true },
  })
  const deliveryCountMap = new Map(deliveryCounts.map((d) => [d.supplierId, d._count._all]))

  const bySupplier: Record<string, {
    supplierId: string
    name: string
    revenue: number
    cost: number
    quantity: number
    settlementCount: number
    productIds: Set<string>
    lastSettledAt: Date | null
  }> = {}

  for (const s of settlements) {
    const sup = s.delivery.supplier
    if (!bySupplier[sup.id]) {
      bySupplier[sup.id] = {
        supplierId: sup.id,
        name: sup.name,
        revenue: 0,
        cost: 0,
        quantity: 0,
        settlementCount: 0,
        productIds: new Set(),
        lastSettledAt: null,
      }
    }
    const agg = bySupplier[sup.id]
    agg.settlementCount += 1
    if (!agg.lastSettledAt || s.settledAt > agg.lastSettledAt) agg.lastSettledAt = s.settledAt
    for (const item of s.items) {
      agg.revenue += item.totalAmountCt
      agg.cost += item.quantitySold * item.product.purchasePriceCt
      agg.quantity += item.quantitySold
      agg.productIds.add(item.productId)
    }
  }

  const result = Object.values(bySupplier)
    .map((s) => {
      const profit = s.revenue - s.cost
      return {
        supplierId: s.supplierId,
        name: s.name,
        revenue: s.revenue,
        cost: s.cost,
        profit,
        quantity: s.quantity,
        settlementCount: s.settlementCount,
        deliveryCount: deliveryCountMap.get(s.supplierId) ?? s.settlementCount,
        productCount: s.productIds.size,
        avgPriceCt: s.quantity > 0 ? Math.round(s.revenue / s.quantity) : 0,
        marginPct: s.revenue > 0 ? (profit / s.revenue) * 100 : 0,
        lastSettledAt: s.lastSettledAt,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json(result)
}
