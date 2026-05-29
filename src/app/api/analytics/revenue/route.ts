export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { forecast } from '@/lib/calculations'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const settlements = await prisma.settlement.findMany({
    include: {
      items: {
        where: productId ? { productId } : undefined,
        include: { product: true },
      },
    },
    orderBy: { settledAt: 'asc' },
  })

  // Group by month
  const byMonth: Record<string, { revenue: number; cost: number; quantity: number }> = {}
  for (const s of settlements) {
    const key = `${s.settledAt.getFullYear()}-${String(s.settledAt.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = { revenue: 0, cost: 0, quantity: 0 }
    for (const item of s.items) {
      byMonth[key].revenue += item.totalAmountCt
      byMonth[key].cost += item.quantitySold * item.product.purchasePriceCt
      byMonth[key].quantity += item.quantitySold
    }
  }

  const history = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({
      period,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      quantity: data.quantity,
    }))

  const forecastData = forecast(history.map((h) => ({ period: h.period, revenue: h.revenue, quantity: h.quantity })))

  return NextResponse.json({ history, forecast: forecastData })
}
