export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress } from '@/lib/delivery'

/**
 * Verkäufer-Analyse (Außendienst).
 *
 * Geschäftsmodell: Jeder Verkäufer holt alle 1–3 Tage eine Ladung Ware ab,
 * verkauft sie face2face und rechnet danach ab. Diese Auswertung zeigt je
 * Verkäufer, wie gut er performt:
 *  - Umsatz / Gewinn / Marge / Ø-Verkaufspreis
 *  - Abverkaufsquote: wie viel der übergebenen Ware tatsächlich verkauft wurde
 *  - Durchlaufzeit: Ø Tage von der Übergabe bis zur Abrechnung
 *  - Ware unterwegs: Wert der aktuell beim Verkäufer liegenden (offenen) Ware
 *  - Retourenquote: wie viel zurückkam
 */
export async function GET() {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date()

  const deliveries = await prisma.delivery.findMany({
    include: {
      supplier: true,
      items: { include: { product: true } },
      settlements: { include: { items: { include: { product: true } } } },
      returns: { include: { items: true } },
    },
  })

  // Ø-Verkaufspreis je Produkt (für die Bewertung offener Ware), global über alle Abrechnungen
  const soldByProduct = new Map<string, { revenue: number; units: number }>()
  for (const d of deliveries) {
    for (const s of d.settlements) {
      for (const it of s.items) {
        const agg = soldByProduct.get(it.productId) ?? { revenue: 0, units: 0 }
        agg.revenue += it.totalAmountCt
        agg.units += it.quantitySold
        soldByProduct.set(it.productId, agg)
      }
    }
  }

  interface Agg {
    supplierId: string
    name: string
    revenue: number
    cost: number
    quantity: number
    settlementCount: number
    deliveryCount: number
    activeDeliveries: number
    productIds: Set<string>
    lastSettledAt: Date | null
    lastDeliveryAt: Date | null
    unitsDelivered: number
    openUnits: number
    openReceivablesCt: number
    returnUnits: number
    cycleDaysSum: number
    cycleSamples: number
  }

  const bySupplier = new Map<string, Agg>()
  const ensure = (id: string, name: string): Agg => {
    let a = bySupplier.get(id)
    if (!a) {
      a = {
        supplierId: id, name, revenue: 0, cost: 0, quantity: 0,
        settlementCount: 0, deliveryCount: 0, activeDeliveries: 0,
        productIds: new Set(), lastSettledAt: null, lastDeliveryAt: null,
        unitsDelivered: 0, openUnits: 0, openReceivablesCt: 0, returnUnits: 0,
        cycleDaysSum: 0, cycleSamples: 0,
      }
      bySupplier.set(id, a)
    }
    return a
  }

  for (const d of deliveries) {
    const sup = d.supplier
    if (!sup) continue
    const agg = ensure(sup.id, sup.name)
    agg.deliveryCount += 1
    if (d.deliveryDate && (!agg.lastDeliveryAt || d.deliveryDate > agg.lastDeliveryAt)) {
      agg.lastDeliveryAt = d.deliveryDate
    }

    const counts = d.status !== 'CANCELLED' && d.status !== 'PENDING'
    if (counts) {
      if (d.status === 'DELIVERED' || d.status === 'PARTIALLY_SETTLED') agg.activeDeliveries += 1
      for (const it of d.items) agg.unitsDelivered += it.quantitySent
    }

    // Abrechnungen → Umsatz/Kosten/Menge + Durchlaufzeit
    for (const s of d.settlements) {
      agg.settlementCount += 1
      if (!agg.lastSettledAt || s.settledAt > agg.lastSettledAt) agg.lastSettledAt = s.settledAt
      if (d.deliveryDate) {
        const days = Math.max(0, (s.settledAt.getTime() - d.deliveryDate.getTime()) / DAY)
        agg.cycleDaysSum += days
        agg.cycleSamples += 1
      }
      for (const it of s.items) {
        agg.revenue += it.totalAmountCt
        agg.cost += it.quantitySold * it.product.purchasePriceCt
        agg.quantity += it.quantitySold
        agg.productIds.add(it.productId)
      }
    }

    // Retouren
    for (const r of d.returns) for (const it of r.items) agg.returnUnits += it.quantityReturned

    // Offene Ware (noch beim Verkäufer)
    if (counts) {
      const prog = deliveryProgress(d)
      for (const p of prog.perProduct) {
        if (p.quantityOpen <= 0) continue
        agg.openUnits += p.quantityOpen
        const di = d.items.find((x) => x.productId === p.productId)
        const sold = soldByProduct.get(p.productId)
        const avgSale = sold && sold.units > 0 ? Math.round(sold.revenue / sold.units) : 0
        const unitPrice = di?.expectedPriceCt ?? avgSale
        agg.openReceivablesCt += p.quantityOpen * unitPrice
      }
    }
  }

  const result = Array.from(bySupplier.values())
    .map((s) => {
      const profit = s.revenue - s.cost
      const settledUnits = s.quantity + s.returnUnits // verkauft + retour = "abgearbeitet"
      return {
        supplierId: s.supplierId,
        name: s.name,
        revenue: s.revenue,
        cost: s.cost,
        profit,
        quantity: s.quantity,
        settlementCount: s.settlementCount,
        deliveryCount: s.deliveryCount,
        activeDeliveries: s.activeDeliveries,
        productCount: s.productIds.size,
        avgPriceCt: s.quantity > 0 ? Math.round(s.revenue / s.quantity) : 0,
        marginPct: s.revenue > 0 ? (profit / s.revenue) * 100 : 0,
        unitsDelivered: s.unitsDelivered,
        openUnits: s.openUnits,
        openReceivablesCt: s.openReceivablesCt,
        returnUnits: s.returnUnits,
        sellThroughPct: s.unitsDelivered > 0 ? (s.quantity / s.unitsDelivered) * 100 : 0,
        returnRatePct: s.unitsDelivered > 0 ? (s.returnUnits / s.unitsDelivered) * 100 : 0,
        avgCycleDays: s.cycleSamples > 0 ? s.cycleDaysSum / s.cycleSamples : null,
        daysSinceLastDelivery: s.lastDeliveryAt ? Math.floor((now.getTime() - s.lastDeliveryAt.getTime()) / DAY) : null,
        lastSettledAt: s.lastSettledAt,
        lastDeliveryAt: s.lastDeliveryAt,
        unitsSettledOrReturned: settledUnits,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json(result)
}
