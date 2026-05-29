export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { forecast } from '@/lib/calculations'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const periods = parseInt(searchParams.get('periods') || '3')

  const items = await prisma.settlementItem.findMany({
    where: productId ? { productId } : undefined,
    include: { settlement: true, product: true },
    orderBy: { settlement: { settledAt: 'asc' } },
  })

  const byMonth: Record<string, { quantity: number; revenue: number }> = {}
  for (const item of items) {
    const key = `${item.settlement.settledAt.getFullYear()}-${String(item.settlement.settledAt.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = { quantity: 0, revenue: 0 }
    byMonth[key].quantity += item.quantitySold
    byMonth[key].revenue += item.totalAmountCt
  }

  const history = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({ period, ...data }))

  if (history.length < 2) {
    return NextResponse.json({ error: 'INSUFFICIENT_DATA', minimumRequired: 2 }, { status: 422 })
  }

  return NextResponse.json({ history, forecast: forecast(history, periods) })
}
