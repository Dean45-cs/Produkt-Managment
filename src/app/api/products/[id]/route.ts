export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

function intOrZero(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      group: true,
      inventory: { include: { location: true } },
      stockAdjustments: { orderBy: { createdAt: 'desc' }, take: 20, include: { location: true } },
      settlementItems: {
        orderBy: { settlement: { settledAt: 'desc' } },
        take: 10,
        include: { settlement: true },
      },
      reviews: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, sku, description, imageUrl, categoryId, groupId, variantName, unit, purchasePriceCt, minStockLevel, reorderPoint, reorderQty } = body
  if (!name?.trim() || !sku?.trim()) {
    return NextResponse.json({ error: 'Name and SKU required' }, { status: 400 })
  }
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name.trim(),
        sku: sku.trim(),
        description,
        imageUrl: imageUrl || null,
        categoryId: categoryId || null,
        groupId: groupId || null,
        variantName: variantName?.trim() || null,
        unit,
        purchasePriceCt: intOrZero(purchasePriceCt),
        minStockLevel: intOrZero(minStockLevel),
        reorderPoint: intOrZero(reorderPoint),
        reorderQty: intOrZero(reorderQty),
      },
      include: { category: true, group: true },
    })
    return NextResponse.json(product)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.product.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
