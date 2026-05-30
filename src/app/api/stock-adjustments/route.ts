export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET() {
  const adjustments = await prisma.stockAdjustment.findMany({
    include: { product: true, location: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  return NextResponse.json(adjustments)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { productId, locationId, delta, reason, note } = body

  if (!productId || !locationId || delta === undefined) {
    return NextResponse.json({ error: 'productId, locationId, delta required' }, { status: 400 })
  }
  if (!Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ error: 'delta muss eine ganze Zahl ungleich 0 sein' }, { status: 400 })
  }

  try {
    const adjustment = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({
        where: { productId_locationId: { productId, locationId } },
      })
      const current = inv?.quantity ?? 0
      const next = current + delta
      if (next < 0) {
        throw Object.assign(
          new Error(`Bestand würde negativ (${current} ${delta >= 0 ? '+' : ''}${delta} = ${next})`),
          { statusCode: 400 }
        )
      }
      const adj = await tx.stockAdjustment.create({
        data: { productId, locationId, delta, reason: reason || 'MANUAL_CORRECTION', note },
      })
      await tx.inventory.upsert({
        where: { productId_locationId: { productId, locationId } },
        create: { productId, locationId, quantity: next },
        update: { quantity: next },
      })
      return adj
    })
    return NextResponse.json(adjustment, { status: 201 })
  } catch (err) {
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode) return NextResponse.json({ error: e.message }, { status: e.statusCode })
    return handlePrismaError(err)
  }
}
