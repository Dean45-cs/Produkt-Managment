export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      delivery: { include: { supplier: true, items: { include: { product: true } } } },
      items: { include: { product: { include: { category: true } } } },
    },
  })
  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(settlement)
}
