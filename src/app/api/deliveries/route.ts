export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError, isPositiveInt } from '@/lib/api-errors'

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

  type Item = { productId: string; locationId: string; quantitySent: number; expectedPriceCt?: number; batchNumber?: string }
  const typedItems = items as Item[]
  for (const item of typedItems) {
    if (!item.productId || !item.locationId) {
      return NextResponse.json({ error: 'Jede Position braucht Produkt und Standort' }, { status: 400 })
    }
    if (!isPositiveInt(item.quantitySent)) {
      return NextResponse.json({ error: 'Menge muss eine positive ganze Zahl sein' }, { status: 400 })
    }
    if (item.expectedPriceCt != null && (!Number.isInteger(item.expectedPriceCt) || item.expectedPriceCt < 0)) {
      return NextResponse.json({ error: 'Erwarteter Preis darf nicht negativ sein' }, { status: 400 })
    }
  }
  // Doppelte Produkte in einer Lieferung verletzen @@unique([deliveryId, productId]).
  const seen = new Set<string>()
  for (const item of typedItems) {
    if (seen.has(item.productId)) {
      return NextResponse.json({ error: 'Ein Produkt darf pro Lieferung nur einmal vorkommen' }, { status: 400 })
    }
    seen.add(item.productId)
  }

  try {
    const delivery = await prisma.delivery.create({
      data: {
        supplierId,
        notes,
        status: 'PENDING',
        items: {
          create: typedItems.map((item) => ({
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
  } catch (err) {
    return handlePrismaError(err)
  }
}
