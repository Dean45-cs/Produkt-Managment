import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { settledAt, totalAmountCt, notes, items } = body

  if (!items?.length) return NextResponse.json({ error: 'Items required' }, { status: 400 })
  if (!totalAmountCt) return NextResponse.json({ error: 'totalAmountCt required' }, { status: 400 })

  const delivery = await prisma.delivery.findUnique({ where: { id } })
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (delivery.status === 'SETTLED') return NextResponse.json({ error: 'Already settled' }, { status: 400 })

  const settlement = await prisma.$transaction(async (tx) => {
    const s = await tx.settlement.create({
      data: {
        deliveryId: id,
        settledAt: settledAt ? new Date(settledAt) : new Date(),
        totalAmountCt,
        notes,
        items: {
          create: items.map((item: { productId: string; quantitySold: number; totalAmountCt: number }) => ({
            productId: item.productId,
            quantitySold: item.quantitySold,
            totalAmountCt: item.totalAmountCt,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    })

    await tx.delivery.update({ where: { id }, data: { status: 'SETTLED' } })

    return s
  })

  return NextResponse.json(settlement, { status: 201 })
}
