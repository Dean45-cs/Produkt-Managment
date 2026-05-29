import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Lieferanten-/Distributoren-Vergleich: Aggregiert alle Abrechnungspositionen
 * je Lieferant. Zeigt, welcher Distributor die höheren Durchschnittspreise zahlt.
 */
export async function GET() {
  const settlements = await prisma.settlement.findMany({
    include: {
      delivery: { include: { supplier: true } },
      items: { include: { product: true } },
    },
  })

  const bySupplier: Record<string, {
    supplierId: string
    name: string
    revenue: number
    cost: number
    quantity: number
    settlementCount: number
  }> = {}

  for (const s of settlements) {
    const sup = s.delivery.supplier
    if (!bySupplier[sup.id]) {
      bySupplier[sup.id] = { supplierId: sup.id, name: sup.name, revenue: 0, cost: 0, quantity: 0, settlementCount: 0 }
    }
    bySupplier[sup.id].settlementCount += 1
    for (const item of s.items) {
      bySupplier[sup.id].revenue += item.totalAmountCt
      bySupplier[sup.id].cost += item.quantitySold * item.product.purchasePriceCt
      bySupplier[sup.id].quantity += item.quantitySold
    }
  }

  const result = Object.values(bySupplier)
    .map((s) => {
      const profit = s.revenue - s.cost
      return {
        ...s,
        profit,
        avgPriceCt: s.quantity > 0 ? Math.round(s.revenue / s.quantity) : 0,
        marginPct: s.revenue > 0 ? (profit / s.revenue) * 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json(result)
}
