export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { items, locationId } = body

  if (!items?.length || !locationId) {
    return NextResponse.json({ error: 'items and locationId required' }, { status: 400 })
  }

  const typedItems = items as { purchaseOrderItemId: string; quantityReceived: number }[]
  if (typedItems.some((i) => !Number.isInteger(i.quantityReceived) || i.quantityReceived <= 0)) {
    return NextResponse.json({ error: 'quantityReceived muss eine positive ganze Zahl sein' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    for (const item of typedItems) {
      // purchaseOrderId-Prüfung verhindert, dass fremde Bestellpositionen verändert werden.
      const poi = await tx.purchaseOrderItem.update({
        where: { id: item.purchaseOrderItemId, purchaseOrderId: id },
        data: { quantityReceived: { increment: item.quantityReceived } },
      })

      await tx.stockAdjustment.create({
        data: {
          productId: poi.productId,
          locationId,
          delta: item.quantityReceived,
          reason: 'PURCHASE_RECEIVED',
          note: `Einkaufsbestellung ${id}`,
        },
      })

      await tx.inventory.upsert({
        where: { productId_locationId: { productId: poi.productId, locationId } },
        create: { productId: poi.productId, locationId, quantity: item.quantityReceived },
        update: { quantity: { increment: item.quantityReceived } },
      })
    }

    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (order) {
      const allReceived = order.items.every((i) => i.quantityReceived >= i.quantityOrdered)
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          receivedAt: allReceived ? new Date() : undefined,
        },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
