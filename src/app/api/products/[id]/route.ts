import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      inventory: { include: { location: true } },
      stockAdjustments: { orderBy: { createdAt: 'desc' }, take: 20, include: { location: true } },
      settlementItems: {
        orderBy: { settlement: { settledAt: 'desc' } },
        take: 10,
        include: { settlement: true },
      },
    },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, sku, description, imageUrl, categoryId, unit, purchasePriceCt, minStockLevel, reorderPoint, reorderQty } = body
  const product = await prisma.product.update({
    where: { id },
    data: { name, sku, description, imageUrl: imageUrl || null, categoryId: categoryId || null, unit, purchasePriceCt, minStockLevel, reorderPoint, reorderQty },
    include: { category: true },
  })
  return NextResponse.json(product)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.product.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
