export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: true, location: true } },
      settlements: { include: { items: { include: { product: true } } }, orderBy: { settledAt: 'asc' } },
      returns: { include: { items: { include: { product: true, location: true } } } },
    },
  })
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(delivery)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { status, deliveryDate, notes } = body

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // When marking as DELIVERED: deduct stock
  if (status === 'DELIVERED' && delivery.status === 'PENDING') {
    await prisma.$transaction([
      prisma.delivery.update({
        where: { id },
        data: { status, deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(), notes },
      }),
      ...delivery.items.flatMap((item) => [
        prisma.stockAdjustment.create({
          data: {
            productId: item.productId,
            locationId: item.locationId,
            delta: -item.quantitySent,
            reason: 'DELIVERY_SENT',
            note: `Lieferung ${id}`,
          },
        }),
        prisma.inventory.upsert({
          where: { productId_locationId: { productId: item.productId, locationId: item.locationId } },
          create: { productId: item.productId, locationId: item.locationId, quantity: 0 },
          update: { quantity: { decrement: item.quantitySent } },
        }),
      ]),
    ])
  } else {
    await prisma.delivery.update({
      where: { id },
      data: { status, deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined, notes },
    })
  }

  const updated = await prisma.delivery.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true, location: true } }, settlements: true },
  })
  return NextResponse.json(updated)
}
