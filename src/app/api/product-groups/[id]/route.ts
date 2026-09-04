export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const group = await prisma.productGroup.findUnique({
    where: { id },
    include: { category: true, products: { orderBy: { name: 'asc' } } },
  })
  if (!group) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(group)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (body.name !== undefined && !body.name?.trim()) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }

  const data: { name?: string; description?: string | null; categoryId?: string | null } = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.description !== undefined) data.description = body.description || null
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null

  try {
    const group = await prisma.productGroup.update({
      where: { id },
      data,
      include: { category: true, _count: { select: { products: true } } },
    })
    return NextResponse.json(group)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Art nicht löschen, solange noch Sorten daran hängen.
  const inUse = await prisma.product.count({ where: { groupId: id } })
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Art wird noch von ${inUse} Sorte${inUse === 1 ? '' : 'n'} verwendet` },
      { status: 409 }
    )
  }
  try {
    await prisma.productGroup.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handlePrismaError(err)
  }
}
