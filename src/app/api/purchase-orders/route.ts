import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  const order = await prisma.purchaseOrder.create({
    data: {
      supplierId: supplierId || null,
      orderedAt: orderedAt ? new Date(orderedAt) : null,
      status: 'DRAFT',
      notes,
      items: {
        create: (items || []).map((item: { productId: string; quantityOrdered: number; unitPriceCt: number }) => ({
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unitPriceCt: item.unitPriceCt || 0,
        })),
      },
    },
    include: { supplier: true, items: { include: { product: true } } },
  })

  return NextResponse.json(order, { status: 201 })
}
