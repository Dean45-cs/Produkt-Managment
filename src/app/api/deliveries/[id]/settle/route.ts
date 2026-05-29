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

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      settlements: { include: { items: true } },
      returns: { include: { items: true } },
    },
  })
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (delivery.status === DELIVERY_STATUS.PENDING) {
    return NextResponse.json({ error: 'Lieferung muss zuerst als geliefert markiert werden' }, { status: 400 })
  }
  if (delivery.status === DELIVERY_STATUS.CANCELLED) {
    return NextResponse.json({ error: 'Stornierte Lieferung kann nicht abgerechnet werden' }, { status: 400 })
  }

  // Offene Menge je Produkt aus aktuellem Stand berechnen
  const progress = deliveryProgress(delivery)
  const openByProduct = new Map(progress.perProduct.map((p) => [p.productId, p]))

  // Validierung: keine Position über die offene Menge hinaus
  for (const item of items) {
    const p = openByProduct.get(item.productId)
    if (!p) {
      return NextResponse.json({ error: `Produkt ${item.productId} ist nicht Teil dieser Lieferung` }, { status: 400 })
    }
    if (item.quantitySold > p.quantityOpen) {
      return NextResponse.json(
        { error: `Zu viele Stück für "${p.productName}": offen sind nur ${p.quantityOpen}, abgerechnet werden sollen ${item.quantitySold}` },
        { status: 400 }
      )
    }
  }

  const totalAmountCt = items.reduce((s, i) => s + i.totalAmountCt, 0)

  const settlement = await prisma.$transaction(async (tx) => {
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

    // Status anhand der neuen Gesamtlage bestimmen
    const newProgress = deliveryProgress({
      items: delivery.items,
      settlements: [...delivery.settlements, { items }],
      returns: delivery.returns,
    })
    const status = nextDeliveryStatus(delivery.status, newProgress.totalOpen, true)
    await tx.delivery.update({ where: { id }, data: { status } })

    return s
  })

  return NextResponse.json(settlement, { status: 201 })
}
