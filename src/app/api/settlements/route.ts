export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const settlements = await prisma.settlement.findMany({
    include: {
      delivery: { include: { supplier: true } },
      items: { include: { product: true } },
    },
    orderBy: { settledAt: 'desc' },
  })
  return NextResponse.json(settlements)
}
