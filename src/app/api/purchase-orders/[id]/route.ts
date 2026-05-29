export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      supplierId: body.supplierId || null,
      status: body.status,
      notes: body.notes,
      orderedAt: body.orderedAt ? new Date(body.orderedAt) : undefined,
    },
    include: { supplier: true, items: { include: { product: true } } },
  })
  return NextResponse.json(order)
}
