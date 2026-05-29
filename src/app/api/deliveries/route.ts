import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const supplierId = searchParams.get('supplierId')

  const deliveries = await prisma.delivery.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
    },
    include: {
      supplier: true,
      items: { include: { product: true, location: true } },
      settlements: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(deliveries)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { supplierId, notes, items } = body

  if (!supplierId) return NextResponse.json({ error: 'supplierId required' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'At least one item required' }, { status: 400 })

  const delivery = await prisma.delivery.create({
    data: {
      supplierId,
      notes,
      status: 'PENDING',
      items: {
        create: items.map((item: { productId: string; locationId: string; quantitySent: number; expectedPriceCt?: number; batchNumber?: string }) => ({
          productId: item.productId,
          locationId: item.locationId,
          quantitySent: item.quantitySent,
          expectedPriceCt: item.expectedPriceCt,
          batchNumber: item.batchNumber?.trim() || null,
        })),
      },
    },
    include: {
      supplier: true,
      items: { include: { product: true, location: true } },
    },
  })

  return NextResponse.json(delivery, { status: 201 })
}
