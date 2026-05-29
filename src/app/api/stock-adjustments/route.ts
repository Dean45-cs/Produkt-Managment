export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  const [adjustment] = await prisma.$transaction([
    prisma.stockAdjustment.create({
      data: { productId, locationId, delta, reason: reason || 'MANUAL_CORRECTION', note },
    }),
    prisma.inventory.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: Math.max(0, delta) },
      update: { quantity: { increment: delta } },
    }),
  ])

  return NextResponse.json(adjustment, { status: 201 })
}
