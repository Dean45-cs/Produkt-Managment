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
      throw Object.assign(new Error('Ladung muss zuerst an den Verkäufer übergeben werden'), { statusCode: 400 })
    }
    if (delivery.status === DELIVERY_STATUS.CANCELLED) {
      throw Object.assign(new Error('Stornierte Ladung kann nicht abgerechnet werden'), { statusCode: 400 })
    }

    const progress = deliveryProgress(delivery)
    const openByProduct = new Map(progress.perProduct.map((p) => [p.productId, p]))

    for (const item of items) {
      const p = openByProduct.get(item.productId)
      if (!p) {
        throw Object.assign(new Error(`Produkt ${item.productId} ist nicht Teil dieser Lieferung`), { statusCode: 400 })
      }
      if (item.quantitySold > p.quantityOpen) {
        throw Object.assign(
          new Error(`Zu viele Stück für "${p.productName}": offen sind nur ${p.quantityOpen}, abgerechnet werden sollen ${item.quantitySold}`),
          { statusCode: 400 }
        )
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
