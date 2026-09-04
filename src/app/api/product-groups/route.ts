export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

/**
 * Arten von Ware (z.B. "Kaffee"). Darunter hängen die einzelnen Sorten, die
 * ganz normale Produkte mit eigenem Bestand und Preis bleiben.
 */
export async function GET() {
  const groups = await prisma.productGroup.findMany({
    include: { category: true, _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(groups)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, description, categoryId } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  try {
    const group = await prisma.productGroup.create({
      data: { name: name.trim(), description: description || null, categoryId: categoryId || null },
      include: { category: true, _count: { select: { products: true } } },
    })
    return NextResponse.json(group, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
