export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { arrayToCsv, centsToCsvNumber, csvResponse } from '@/lib/csv'

export async function GET() {
  const inventory = await prisma.inventory.findMany({
    include: { product: true, location: true },
    orderBy: [{ location: { name: 'asc' } }, { product: { name: 'asc' } }],
  })

  const headers = ['Standort', 'SKU', 'Produkt', 'Menge', 'EK-Preis (€)', 'Bestandswert (€)', 'Nachbestellpunkt', 'Status']
  const rows = inventory.map((inv) => {
    const value = inv.quantity * inv.product.purchasePriceCt
    const status = inv.quantity === 0 ? 'Leer' : inv.quantity <= inv.product.reorderPoint ? 'Niedrig' : 'OK'
    return [
      inv.location.name,
      inv.product.sku,
      inv.product.name,
      inv.quantity,
      centsToCsvNumber(inv.product.purchasePriceCt),
      centsToCsvNumber(value),
      inv.product.reorderPoint,
      status,
    ]
  })

  return csvResponse(arrayToCsv(headers, rows), 'bestand.csv')
}
