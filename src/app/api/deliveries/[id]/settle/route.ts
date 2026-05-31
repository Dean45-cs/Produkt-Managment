export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress, nextDeliveryStatus, DELIVERY_STATUS } from '@/lib/delivery'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { settledAt, notes } = body
  const rawItems: { productId: string; quantitySold: number; totalAmountCt: number }[] = body.items || []

  // Nur Positionen mit verkaufter Menge zählen als (Teil-)Abrechnung
  const items = rawItems.filter((i) => i.quantitySold > 0)
  if (!items.length) return NextResponse.json({ error: 'Mindestens eine verkaufte Position erforderlich' }, { status: 400 })

  if (items.some((i) => i.totalAmountCt < 0)) {
    return NextResponse.json({ error: 'Betrag darf nicht negativ sein' }, { status: 400 })
  }

  // Validierung + Schreiben in einer Transaktion – verhindert Race Conditions bei
  // gleichzeitigen Teilabrechnungen (z.B. zwei Browser-Tabs).
  let settlement
  try {
  settlement = await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        settlements: { include: { items: true } },
        returns: { include: { items: true } },
      },
    })
    if (!delivery) return null

    if (delivery.status === DELIVERY_STATUS.PENDING) {
      throw Object.assign(new Error('Lieferung muss zuerst als geliefert markiert werden'), { statusCode: 400 })
    }
    if (delivery.status === DELIVERY_STATUS.CANCELLED) {
      throw Object.assign(new Error('Stornierte Lieferung kann nicht abgerechnet werden'), { statusCode: 400 })
    }

    const progress = deliveryProgress(delivery)
    const openByProduct = new Map(progress.perProduct.map((p) => [p.productId, p]))
    const locByProduct = new Map(delivery.items.map((it) => [it.productId, it.locationId]))

    for (const item of items) {
      const p = openByProduct.get(item.productId)
      if (!p) {
        throw Object.assign(new Error(`Produkt ${item.productId} ist nicht Teil dieser Lieferung`), { statusCode: 400 })
      }
      if (item.quantitySold > p.quantityOpen) {
        throw Object.assign(
          new Error(`Zu viele Stück für "${p.productName}": offen sind nur ${p.quantityOpen}, verkauft werden sollen ${item.quantitySold}`),
          { statusCode: 400 }
        )
      }
      // Verkaufte Ware verlässt das Lager → prüfen, ob genug Bestand vorhanden ist.
      const locationId = locByProduct.get(item.productId)
      if (locationId) {
        const inv = await tx.inventory.findUnique({
          where: { productId_locationId: { productId: item.productId, locationId } },
        })
        const available = inv?.quantity ?? 0
        if (available < item.quantitySold) {
          throw Object.assign(
            new Error(`Nicht genug Bestand für "${p.productName}": verfügbar ${available}, verkauft werden sollen ${item.quantitySold}`),
            { statusCode: 400 }
          )
        }
      }
    }

    const totalAmountCt = items.reduce((s, i) => s + i.totalAmountCt, 0)

    const s = await tx.settlement.create({
      data: {
        deliveryId: id,
        settledAt: settledAt ? new Date(settledAt) : new Date(),
        totalAmountCt,
        notes,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantitySold: item.quantitySold,
            totalAmountCt: item.totalAmountCt,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    })

    // Bestand abbuchen: die verkauften Stück verlassen das Lager.
    for (const item of items) {
      const locationId = locByProduct.get(item.productId)
      if (!locationId) continue
      await tx.stockAdjustment.create({
        data: { productId: item.productId, locationId, delta: -item.quantitySold, reason: 'SALE', note: `Verkauf Lieferung ${id}` },
      })
      await tx.inventory.update({
        where: { productId_locationId: { productId: item.productId, locationId } },
        data: { quantity: { decrement: item.quantitySold } },
      })
    }

    const newProgress = deliveryProgress({
      items: delivery.items,
      settlements: [...delivery.settlements, { items }],
      returns: delivery.returns,
    })
    const status = nextDeliveryStatus(delivery.status, newProgress.totalOpen, true)
    await tx.delivery.update({ where: { id }, data: { status } })

    return s
  })
  } catch (err) {
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode) return NextResponse.json({ error: e.message }, { status: e.statusCode })
    throw err
  }

  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(settlement, { status: 201 })
}
