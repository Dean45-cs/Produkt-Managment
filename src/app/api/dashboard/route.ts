import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOf12MonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  const [
    pendingDeliveries,
    products,
    inventory,
    monthSettlements,
    allSettlements,
  ] = await Promise.all([
    prisma.delivery.findMany({
      where: { status: { in: ['DELIVERED', 'PARTIALLY_SETTLED'] } },
      include: { supplier: true, items: { include: { product: true } } },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, purchasePriceCt: true, minStockLevel: true, reorderPoint: true },
    }),
    prisma.inventory.findMany({
      include: { product: true, location: true },
    }),
    prisma.settlement.findMany({
      where: { settledAt: { gte: startOfMonth } },
      include: { items: { include: { product: true } } },
    }),
    prisma.settlement.findMany({
      where: { settledAt: { gte: startOf12MonthsAgo } },
      include: { items: { include: { product: true } } },
    }),
  ])

  // Total inventory value
  const totalInventoryValue = inventory.reduce(
    (sum, inv) => sum + inv.quantity * inv.product.purchasePriceCt,
    0
  )

  // This month revenue & profit
  const monthRevenue = monthSettlements.reduce((sum, s) => sum + s.totalAmountCt, 0)
  const monthCost = monthSettlements.reduce(
    (sum, s) => sum + s.items.reduce((isum, i) => isum + i.quantitySold * i.product.purchasePriceCt, 0),
    0
  )

  // Low stock products
  const productStock: Record<string, number> = {}
  for (const inv of inventory) {
    productStock[inv.productId] = (productStock[inv.productId] || 0) + inv.quantity
  }
  const lowStockProducts = products
    .filter((p) => (productStock[p.id] || 0) <= p.reorderPoint)
    .map((p) => ({ ...p, currentStock: productStock[p.id] || 0 }))

  // Monthly revenue chart (last 12 months)
  const monthlyRevenue: Record<string, { revenue: number; cost: number }> = {}
  for (const s of allSettlements) {
    const key = `${s.settledAt.getFullYear()}-${String(s.settledAt.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyRevenue[key]) monthlyRevenue[key] = { revenue: 0, cost: 0 }
    monthlyRevenue[key].revenue += s.totalAmountCt
    monthlyRevenue[key].cost += s.items.reduce((sum, i) => sum + i.quantitySold * i.product.purchasePriceCt, 0)
  }
  const monthlyRevenueArray = Object.entries(monthlyRevenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({ period, ...data }))

  // Top products by revenue (this month)
  const productRevenue: Record<string, { name: string; revenue: number; quantity: number }> = {}
  for (const s of monthSettlements) {
    for (const item of s.items) {
      if (!productRevenue[item.productId]) {
        productRevenue[item.productId] = { name: item.product.name, revenue: 0, quantity: 0 }
      }
      productRevenue[item.productId].revenue += item.totalAmountCt
      productRevenue[item.productId].quantity += item.quantitySold
    }
  }
  const topProducts = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return NextResponse.json({
    totalInventoryValue,
    pendingDeliveriesCount: pendingDeliveries.length,
    pendingDeliveries,
    monthRevenue,
    monthProfit: monthRevenue - monthCost,
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
    monthlyRevenue: monthlyRevenueArray,
    topProducts,
  })
}
