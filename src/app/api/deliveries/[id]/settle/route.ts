export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSettlement, SettlementError } from '@/lib/settle'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { settledAt, notes } = body
  const items: { productId: string; quantitySold: number; totalAmountCt: number }[] = body.items || []

  try {
    const settlement = await createSettlement(prisma, id, { settledAt, notes, items })
    return NextResponse.json(settlement, { status: 201 })
  } catch (err) {
    if (err instanceof SettlementError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}
