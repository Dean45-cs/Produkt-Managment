export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Nachbestellvorschläge: alle aktiven Produkte, deren Gesamtbestand (über alle
 * Standorte) den Nachbestellpunkt erreicht oder unterschritten hat.
 * Vorgeschlagene Menge = reorderQty (Fallback: Differenz bis Mindestbestand, min. 1).
 */
export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { inventory: true },
    orderBy: { name: 'asc' },
  })

  const suggestions = products
    .map((p) => {
      const currentStock = p.inventory.reduce((s, i) => s + i.quantity, 0)
      return { product: p, currentStock }
    })
    .filter(({ product, currentStock }) => currentStock <= product.reorderPoint)
    .map(({ product, currentStock }) => {
      const suggestedQty = product.reorderQty > 0
        ? product.reorderQty
        : Math.max(1, product.minStockLevel - currentStock)
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        currentStock,
        reorderPoint: product.reorderPoint,
        suggestedQty,
        unitPriceCt: product.purchasePriceCt,
      }
    })

  return NextResponse.json(suggestions)
}
