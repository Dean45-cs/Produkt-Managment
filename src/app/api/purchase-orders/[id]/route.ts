export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

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

  // Nur senden, was tatsächlich im Body steht. Sonst würde z.B. "Als bestellt
  // markieren" (schickt nur status + orderedAt) den Lieferanten auf null setzen.
  const data: {
    supplierId?: string | null
    status?: string
    notes?: string | null
    orderedAt?: Date
  } = {}
  if ('supplierId' in body) data.supplierId = body.supplierId || null
  if (body.status !== undefined) data.status = body.status
  if (body.notes !== undefined) data.notes = body.notes
  if (body.orderedAt) data.orderedAt = new Date(body.orderedAt)

  try {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data,
      include: { supplier: true, items: { include: { product: true } } },
    })
    return NextResponse.json(order)
  } catch (err) {
    return handlePrismaError(err)
  }
}
