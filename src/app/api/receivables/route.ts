export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress } from '@/lib/delivery'

/**
 * Offene Posten: Welche Ware liegt noch bei welchem Verkäufer und ist noch
 * nicht abgerechnet? Gruppiert je Verkäufer, mit Wert der offenen Ware und
 * Alter der Ladung. Ladungen, die länger als 3 Tage draußen sind, gelten als
 * überfällig (Verkäufer kommen normalerweise alle 1–3 Tage).
 */
export async function GET() {
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  const OVERDUE_DAYS = 3

  const deliveries = await prisma.delivery.findMany({
    where: { status: { in: ['DELIVERED', 'PARTIALLY_SETTLED'] } },
    include: {
      supplier: true,
      items: { include: { product: true } },
      settlements: { include: { items: true } },
      returns: { include: { items: true } },
    },
  })

  // Ø-Verkaufspreis je Produkt (global) zum Bewerten offener Ware
  const allItems = await prisma.settlementItem.findMany()
  const soldByProduct = new Map<string, { revenue: number; units: number }>()
  for (const it of allItems) {
    const a = soldByProduct.get(it.productId) ?? { revenue: 0, units: 0 }
    a.revenue += it.totalAmountCt; a.units += it.quantitySold
    soldByProduct.set(it.productId, a)
  }

  interface OpenDelivery {
    id: string; deliveryDate: Date | null; createdAt: Date
    daysOut: number; openUnits: number; openValueCt: number; status: string; overdue: boolean
  }
  interface SupplierBucket {
    supplierId: string; name: string
    openUnits: number; openValueCt: number; oldestDaysOut: number; overdue: boolean
    deliveries: OpenDelivery[]
  }

  const bySupplier = new Map<string, SupplierBucket>()
  let totalOpenValueCt = 0, totalOpenUnits = 0, overdueCount = 0

  for (const d of deliveries) {
    const prog = deliveryProgress(d)
    if (prog.totalOpen <= 0) continue

    let openValue = 0
    for (const p of prog.perProduct) {
      if (p.quantityOpen <= 0) continue
      const di = d.items.find((x) => x.productId === p.productId)
      const sold = soldByProduct.get(p.productId)
      const avgSale = sold && sold.units > 0 ? Math.round(sold.revenue / sold.units) : 0
      openValue += p.quantityOpen * (di?.expectedPriceCt ?? avgSale)
    }

    const refDate = d.deliveryDate ?? d.createdAt
    const daysOut = Math.floor((now - refDate.getTime()) / DAY)
    const overdue = daysOut > OVERDUE_DAYS
    if (overdue) overdueCount += 1
    totalOpenValueCt += openValue
    totalOpenUnits += prog.totalOpen

    const sup = d.supplier
    let agg = bySupplier.get(sup.id)
    if (!agg) {
      agg = { supplierId: sup.id, name: sup.name, openUnits: 0, openValueCt: 0, oldestDaysOut: 0, overdue: false, deliveries: [] }
      bySupplier.set(sup.id, agg)
    }
    agg.openUnits += prog.totalOpen
    agg.openValueCt += openValue
    agg.oldestDaysOut = Math.max(agg.oldestDaysOut, daysOut)
    agg.overdue = agg.overdue || overdue
    agg.deliveries.push({
      id: d.id, deliveryDate: d.deliveryDate, createdAt: d.createdAt,
      daysOut, openUnits: prog.totalOpen, openValueCt: openValue, status: d.status, overdue,
    })
  }

  const suppliers = Array.from(bySupplier.values())
    .map((s) => ({ ...s, deliveries: s.deliveries.sort((a, b) => b.daysOut - a.daysOut) }))
    .sort((a, b) => b.openValueCt - a.openValueCt)

  return NextResponse.json({
    suppliers,
    totalOpenValueCt,
    totalOpenUnits,
    overdueCount,
    sellerCount: suppliers.length,
  })
}
