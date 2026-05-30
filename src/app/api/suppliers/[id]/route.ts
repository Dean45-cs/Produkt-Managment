export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(supplier)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, contactName, email, phone, address, notes } = body
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }
  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name: name?.trim(), contactName, email, phone, address, notes },
    })
    return NextResponse.json(supplier)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Lieferant nicht löschen, solange noch Lieferungen/Bestellungen daran hängen.
  const [delCount, poCount] = await Promise.all([
    prisma.delivery.count({ where: { supplierId: id } }),
    prisma.purchaseOrder.count({ where: { supplierId: id } }),
  ])
  if (delCount > 0 || poCount > 0) {
    return NextResponse.json(
      { error: 'Lieferant wird noch von Lieferungen oder Bestellungen verwendet' },
      { status: 409 }
    )
  }
  try {
    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handlePrismaError(err)
  }
}
