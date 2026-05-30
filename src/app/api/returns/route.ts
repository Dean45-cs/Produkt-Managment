export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress, nextDeliveryStatus } from '@/lib/delivery'

export async function GET() {
  const returns = await prisma.return.findMany({
    include: {
      delivery: { include: { supplier: true } },
      items: { include: { product: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(returns)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { deliveryId, returnDate, notes, items } = body

  if (!items?.length) return NextResponse.json({ error: 'Items required' }, { status: 400 })

  const typedItems = items as { productId: string; locationId: string; quantityReturned: number }[]
  if (typedItems.some((i) => !Number.isInteger(i.quantityReturned) || i.quantityReturned <= 0)) {
    return NextResponse.json({ error: 'quantityReturned muss eine positive ganze Zahl sein' }, { status: 400 })
  }

  const ret = await prisma.$transaction(async (tx) => {
    const r = await tx.return.create({
      data: {
        deliveryId: deliveryId || null,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        notes,
        items: {
          create: items.map((item: { productId: string; locationId: string; quantityReturned: number }) => ({
            productId: item.productId,
            locationId: item.locationId,
            quantityReturned: item.quantityReturned,
          })),
        },
      },
      include: { items: { include: { product: true, location: true } } },
    })

    for (const item of typedItems) {
      await tx.stockAdjustment.create({
        data: {
          productId: item.productId,
          locationId: item.locationId,
          delta: item.quantityReturned,
          reason: 'RETURN_FROM_SUPPLIER',
          note: `Retoure ${r.id}`,
        },
      })

      await tx.inventory.upsert({
        where: { productId_locationId: { productId: item.productId, locationId: item.locationId } },
        create: { productId: item.productId, locationId: item.locationId, quantity: item.quantityReturned },
        update: { quantity: { increment: item.quantityReturned } },
      })
    }

    // Retoure reduziert die offene Menge → Lieferungsstatus ggf. anpassen
    if (deliveryId) {
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          items: true,
          settlements: { include: { items: true } },
          returns: { include: { items: true } },
        },
      })
      if (delivery) {
        const progress = deliveryProgress(delivery)
        const status = nextDeliveryStatus(delivery.status, progress.totalOpen, delivery.settlements.length > 0)
        if (status !== delivery.status) {
          await tx.delivery.update({ where: { id: deliveryId }, data: { status } })
        }
      }
    }

    return r
  })

  return NextResponse.json(ret, { status: 201 })
}
