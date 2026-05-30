export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(category)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, description, color } = body
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }
  try {
    const category = await prisma.category.update({
      where: { id },
      data: { name: name?.trim(), description, color },
    })
    return NextResponse.json(category)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Kategorie nicht löschen, solange noch Produkte daran hängen.
  const inUse = await prisma.product.count({ where: { categoryId: id } })
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Kategorie wird noch von ${inUse} Produkt(en) verwendet` },
      { status: 409 }
    )
  }
  try {
    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handlePrismaError(err)
  }
}
