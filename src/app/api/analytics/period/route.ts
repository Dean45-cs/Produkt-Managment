export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress } from '@/lib/delivery'

/**
 * Zeitraum- & Schwund-Analyse.
 *
 * Query-Parameter: ?from=YYYY-MM-DD&to=YYYY-MM-DD (inklusive Tagesgrenzen).
 *
 * Liefert zwei Dinge:
 *  1) Kennzahlen für den gewählten Zeitraum (Umsatz/Gewinn/Stück/Abrechnungen)
 *     PLUS dieselben Werte für die unmittelbar davorliegende, gleich lange
 *     Vorperiode – für einen direkten Vergleich (Delta).
 *  2) Schwund je Verkäufer: ausgegebene Ware, die nach mehr als
 *     SHRINK_DAYS Tagen weder verkauft noch retourniert wurde (= fehlt).
 *
 * Umsatz/Gewinn werden über das Abrechnungsdatum (settledAt) zugeordnet,
 * Schwund über das Übergabedatum der Ladung (deliveryDate).
 */

const DAY = 24 * 60 * 60 * 1000
// Ab wann gilt ausgegebene, nicht abgerechnete Ware als Schwundverdacht?
const SHRINK_DAYS = 7

/** Parst 'YYYY-MM-DD' als lokales Datum; endOfDay setzt auf 23:59:59.999. */
function parseDay(s: string | null, endOfDay = false): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (endOfDay) d.setHours(23, 59, 59, 999)
  return d
}

interface Bucket {
  revenueCt: number
  costCt: number
  units: number
  settlementCount: number
  unitsDelivered: number
}
const emptyBucket = (): Bucket => ({ revenueCt: 0, costCt: 0, units: 0, settlementCount: 0, unitsDelivered: 0 })

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const now = new Date()

  // Zeitraum bestimmen (Default: letzte 30 Tage)
  const to = parseDay(searchParams.get('to'), true) ?? new Date()
  const from =
    parseDay(searchParams.get('from')) ?? new Date(to.getTime() - 29 * DAY)

  const lengthMs = Math.max(DAY, to.getTime() - from.getTime())
  const prevTo = from
  const prevFrom = new Date(from.getTime() - lengthMs)

  const inCur = (t: Date) => t >= from && t <= to
  const inPrev = (t: Date) => t >= prevFrom && t < from

  // --- 1) Umsatz/Gewinn aus Abrechnungen (nach Abrechnungsdatum) ---
  const settlements = await prisma.settlement.findMany({
    where: { settledAt: { gte: prevFrom, lte: to } },
    include: { items: { include: { product: true } } },
  })

  const cur = emptyBucket()
  const prev = emptyBucket()
  for (const s of settlements) {
    const target = inCur(s.settledAt) ? cur : inPrev(s.settledAt) ? prev : null
    if (!target) continue
    target.settlementCount += 1
    for (const it of s.items) {
      target.revenueCt += it.totalAmountCt
      target.costCt += it.quantitySold * it.product.purchasePriceCt
      target.units += it.quantitySold
    }
  }

  // --- Ø-Verkaufspreis je Produkt (global) zur Bewertung fehlender Ware ---
  const priceAgg = await prisma.settlementItem.groupBy({
    by: ['productId'],
    _sum: { totalAmountCt: true, quantitySold: true },
  })
  const avgSaleCt = new Map<string, number>()
  for (const p of priceAgg) {
    const amt = p._sum.totalAmountCt ?? 0
    const qty = p._sum.quantitySold ?? 0
    if (qty > 0) avgSaleCt.set(p.productId, Math.round(amt / qty))
  }

  // --- 2) Ladungen im Zeitraum (nach Übergabedatum) für Schwund + ausgegebene Menge ---
  const deliveries = await prisma.delivery.findMany({
    where: {
      deliveryDate: { gte: prevFrom, lte: to },
      status: { notIn: ['CANCELLED', 'PENDING'] },
    },
    include: {
      supplier: true,
      items: { include: { product: true } },
      settlements: { include: { items: true } },
      returns: { include: { items: true } },
    },
  })

  interface SellerShrink {
    supplierId: string
    name: string
    sent: number
    sold: number
    returned: number
    stillOut: number // offen, aber noch im Zeitrahmen (kein Schwund)
    missing: number // offen + überfällig = Schwundverdacht
    missingValueCt: number
  }
  const bySeller = new Map<string, SellerShrink>()

  for (const d of deliveries) {
    const when = d.deliveryDate ?? d.createdAt
    // Ausgegebene Menge zählt für die jeweilige Periode (Umsatz-KPIs)
    const sent = d.items.reduce((s, it) => s + it.quantitySent, 0)
    if (inCur(when)) cur.unitsDelivered += sent
    else if (inPrev(when)) prev.unitsDelivered += sent

    // Schwund nur für die aktuelle Periode auswerten
    if (!inCur(when)) continue
    if (!d.supplier) continue

    const overdue = d.status !== 'SETTLED' && when.getTime() < now.getTime() - SHRINK_DAYS * DAY
    const prog = deliveryProgress(d)

    let agg = bySeller.get(d.supplier.id)
    if (!agg) {
      agg = { supplierId: d.supplier.id, name: d.supplier.name, sent: 0, sold: 0, returned: 0, stillOut: 0, missing: 0, missingValueCt: 0 }
      bySeller.set(d.supplier.id, agg)
    }
    agg.sent += prog.totalSent
    agg.sold += prog.totalSettled
    agg.returned += prog.totalReturned

    for (const p of prog.perProduct) {
      if (p.quantityOpen <= 0) continue
      if (overdue) {
        agg.missing += p.quantityOpen
        const di = d.items.find((x) => x.productId === p.productId)
        const priceCt = di?.expectedPriceCt || avgSaleCt.get(p.productId) || di?.product.purchasePriceCt || 0
        agg.missingValueCt += p.quantityOpen * priceCt
      } else {
        agg.stillOut += p.quantityOpen
      }
    }
  }

  const shrinkSellers = Array.from(bySeller.values())
    .map((s) => ({
      ...s,
      missingPct: s.sent > 0 ? (s.missing / s.sent) * 100 : 0,
    }))
    .sort((a, b) => b.missingValueCt - a.missingValueCt || b.missing - a.missing)

  const totalSent = shrinkSellers.reduce((s, x) => s + x.sent, 0)
  const totalMissing = shrinkSellers.reduce((s, x) => s + x.missing, 0)
  const totalMissingValueCt = shrinkSellers.reduce((s, x) => s + x.missingValueCt, 0)
  const totalStillOut = shrinkSellers.reduce((s, x) => s + x.stillOut, 0)

  const withProfit = (b: Bucket) => ({
    revenueCt: b.revenueCt,
    costCt: b.costCt,
    profitCt: b.revenueCt - b.costCt,
    marginPct: b.revenueCt > 0 ? ((b.revenueCt - b.costCt) / b.revenueCt) * 100 : 0,
    units: b.units,
    settlementCount: b.settlementCount,
    avgOrderCt: b.settlementCount > 0 ? Math.round(b.revenueCt / b.settlementCount) : 0,
    unitsDelivered: b.unitsDelivered,
  })

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    prev: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
    current: withProfit(cur),
    previous: withProfit(prev),
    shrinkage: {
      thresholdDays: SHRINK_DAYS,
      totalSent,
      totalMissing,
      totalMissingValueCt,
      totalStillOut,
      missingPct: totalSent > 0 ? (totalMissing / totalSent) * 100 : 0,
      sellers: shrinkSellers,
    },
  })
}
