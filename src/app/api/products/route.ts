export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

/** Wandelt einen Eingabewert in eine nicht-negative ganze Zahl (Default 0). */
function intOrZero(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')
  const search = searchParams.get('search')

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { name: { contains: search } } : {}),
    },
    include: {
      category: true,
      inventory: { include: { location: true } },
    },
    orderBy: { name: 'asc' },
  })

  const enriched = products.map((p) => ({
    ...p,
    totalStock: p.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
    needsReorder: p.inventory.reduce((sum, inv) => sum + inv.quantity, 0) <= p.reorderPoint,
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, sku, description, imageUrl, categoryId, unit, purchasePriceCt, minStockLevel, reorderPoint, reorderQty } = body
  if (!name?.trim() || !sku?.trim()) return NextResponse.json({ error: 'Name and SKU required' }, { status: 400 })

  try {
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        sku: sku.trim(),
        description,
        imageUrl: imageUrl || null,
        categoryId: categoryId || null,
        unit: unit || 'Stück',
        purchasePriceCt: intOrZero(purchasePriceCt),
        minStockLevel: intOrZero(minStockLevel),
        reorderPoint: intOrZero(reorderPoint),
        reorderQty: intOrZero(reorderQty),
      },
      include: { category: true },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
