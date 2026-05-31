export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress } from '@/lib/delivery'

/**
 * Komplettübersicht für einen Verkäufer (Detailseite):
 * Stammdaten, Leistungskennzahlen, alle Ladungen mit Fortschritt (inkl.
 * "noch offen / überfällig") und die letzten Abrechnungen.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.now()

  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const deliveries = await prisma.delivery.findMany({
    where: { supplierId: id },
    include: {
      items: { include: { product: true } },
      settlements: { include: { items: { include: { product: true } } } },
      returns: { include: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Ø-Verkaufspreis je Produkt (dieser Verkäufer) zum Bewerten offener Ware
  const soldByProduct = new Map<string, { revenue: number; units: number }>()
  for (const d of deliveries) for (const s of d.settlements) for (const it of s.items) {
    const a = soldByProduct.get(it.productId) ?? { revenue: 0, units: 0 }
    a.revenue += it.totalAmountCt; a.units += it.quantitySold
    soldByProduct.set(it.productId, a)
  }

  let revenue = 0, cost = 0, quantity = 0, unitsDelivered = 0
  let openUnits = 0, openValueCt = 0, returnUnits = 0
  let cycleSum = 0, cycleSamples = 0, settlementCount = 0
  const settlementList: Array<{ id: string; settledAt: Date; totalAmountCt: number; qty: number }> = []

  const deliveryList = deliveries.map((d) => {
    const counts = d.status !== 'CANCELLED' && d.status !== 'PENDING'
    const prog = deliveryProgress(d)
    let dOpenValue = 0

    if (counts) {
      for (const it of d.items) unitsDelivered += it.quantitySent
      for (const p of prog.perProduct) {
        if (p.quantityOpen <= 0) continue
        const di = d.items.find((x) => x.productId === p.productId)
        const sold = soldByProduct.get(p.productId)
        const avgSale = sold && sold.units > 0 ? Math.round(sold.revenue / sold.units) : 0
        dOpenValue += p.quantityOpen * (di?.expectedPriceCt ?? avgSale)
      }
      openUnits += prog.totalOpen
      openValueCt += dOpenValue
    }

    for (const s of d.settlements) {
      settlementCount += 1
      const qty = s.items.reduce((x, i) => x + i.quantitySold, 0)
      settlementList.push({ id: s.id, settledAt: s.settledAt, totalAmountCt: s.totalAmountCt, qty })
      if (d.deliveryDate) {
        cycleSum += Math.max(0, (s.settledAt.getTime() - d.deliveryDate.getTime()) / DAY)
        cycleSamples += 1
      }
      for (const it of s.items) {
        revenue += it.totalAmountCt
        cost += it.quantitySold * it.product.purchasePriceCt
        quantity += it.quantitySold
      }
    }
    for (const r of d.returns) for (const it of r.items) returnUnits += it.quantityReturned

    const refDate = d.deliveryDate ?? d.createdAt
    const daysOut = counts && prog.totalOpen > 0 ? Math.floor((now - refDate.getTime()) / DAY) : null
    return {
      id: d.id,
      status: d.status,
      deliveryDate: d.deliveryDate,
      createdAt: d.createdAt,
      totalSent: prog.totalSent,
      totalSettled: prog.totalSettled,
      totalReturned: prog.totalReturned,
      totalOpen: prog.totalOpen,
      settledAmountCt: prog.amountSettledCt,
      openValueCt: dOpenValue,
      daysOut,
      overdue: daysOut != null && daysOut > 3,
    }
  })

  const profit = revenue - cost
  settlementList.sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime())

  return NextResponse.json({
    supplier,
    stats: {
      revenue, cost, profit,
      marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
      avgPriceCt: quantity > 0 ? Math.round(revenue / quantity) : 0,
      quantity, unitsDelivered,
      sellThroughPct: unitsDelivered > 0 ? (quantity / unitsDelivered) * 100 : 0,
      avgCycleDays: cycleSamples > 0 ? cycleSum / cycleSamples : null,
      openUnits, openValueCt, returnUnits,
      deliveryCount: deliveries.length, settlementCount,
    },
    deliveries: deliveryList,
    settlements: settlementList.slice(0, 15),
  })
}
