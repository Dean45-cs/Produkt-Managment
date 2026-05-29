export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { arrayToCsv, centsToCsvNumber, csvResponse } from '@/lib/csv'

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true, inventory: true },
    orderBy: { name: 'asc' },
  })

  const headers = [
    'SKU', 'Name', 'Kategorie', 'Einheit', 'EK-Preis (€)',
    'Mindestbestand', 'Nachbestellpunkt', 'Nachbestellmenge', 'Gesamtbestand',
  ]
  const rows = products.map((p) => [
    p.sku,
    p.name,
    p.category?.name ?? '',
    p.unit,
    centsToCsvNumber(p.purchasePriceCt),
    p.minStockLevel,
    p.reorderPoint,
    p.reorderQty,
    p.inventory.reduce((s, i) => s + i.quantity, 0),
  ])

  return csvResponse(arrayToCsv(headers, rows), 'produkte.csv')
}
