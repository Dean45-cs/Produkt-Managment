import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Kundenbewertungen (Sterne). Optional je Produkt filterbar via ?productId= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const reviews = await prisma.review.findMany({
    where: productId ? { productId } : undefined,
    include: { product: { select: { id: true, name: true, sku: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(reviews)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { productId, rating, comment, customerName } = body

  if (!productId) return NextResponse.json({ error: 'productId erforderlich' }, { status: 400 })
  const r = Math.round(Number(rating))
  if (!r || r < 1 || r > 5) return NextResponse.json({ error: 'rating muss zwischen 1 und 5 liegen' }, { status: 400 })

  const review = await prisma.review.create({
    data: {
      productId,
      rating: r,
      comment: comment?.trim() || null,
      customerName: customerName?.trim() || null,
    },
  })

  return NextResponse.json(review, { status: 201 })
}
