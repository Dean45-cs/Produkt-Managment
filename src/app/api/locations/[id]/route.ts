export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const location = await prisma.location.findUnique({ where: { id }, include: { inventory: { include: { product: true } } } })
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(location)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, type, address, notes } = body
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }
  try {
    const location = await prisma.location.update({
      where: { id },
      data: { name: name?.trim(), type, address, notes },
    })
    return NextResponse.json(location)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Standort nicht löschen, solange noch Bestand/Bewegungen daran hängen.
  const [invCount, adjCount] = await Promise.all([
    prisma.inventory.count({ where: { locationId: id } }),
    prisma.stockAdjustment.count({ where: { locationId: id } }),
  ])
  if (invCount > 0 || adjCount > 0) {
    return NextResponse.json(
      { error: 'Standort wird noch von Beständen oder Buchungen verwendet' },
      { status: 409 }
    )
  }
  try {
    await prisma.location.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handlePrismaError(err)
  }
}
