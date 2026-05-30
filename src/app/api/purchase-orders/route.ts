export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError, isPositiveInt } from '@/lib/api-errors'

export async function GET() {
  const orders = await prisma.purchaseOrder.findMany({
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { supplierId, orderedAt, notes, items } = body

  type Item = { productId: string; quantityOrdered: number; unitPriceCt?: number }
  const typedItems = (items || []) as Item[]
  if (!typedItems.length) {
    return NextResponse.json({ error: 'Mindestens eine Position erforderlich' }, { status: 400 })
  }
  for (const item of typedItems) {
    if (!item.productId) {
      return NextResponse.json({ error: 'Jede Position braucht ein Produkt' }, { status: 400 })
    }
    if (!isPositiveInt(item.quantityOrdered)) {
      return NextResponse.json({ error: 'Bestellmenge muss eine positive ganze Zahl sein' }, { status: 400 })
    }
    if (item.unitPriceCt != null && (!Number.isInteger(item.unitPriceCt) || item.unitPriceCt < 0)) {
      return NextResponse.json({ error: 'Einzelpreis darf nicht negativ sein' }, { status: 400 })
    }
  }
  const seen = new Set<string>()
  for (const item of typedItems) {
    if (seen.has(item.productId)) {
      return NextResponse.json({ error: 'Ein Produkt darf pro Bestellung nur einmal vorkommen' }, { status: 400 })
    }
    seen.add(item.productId)
  }

  try {
    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId: supplierId || null,
        orderedAt: orderedAt ? new Date(orderedAt) : null,
        status: 'DRAFT',
        notes,
        items: {
          create: typedItems.map((item) => ({
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitPriceCt: item.unitPriceCt || 0,
          })),
        },
      },
      include: { supplier: true, items: { include: { product: true } } },
    })
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
