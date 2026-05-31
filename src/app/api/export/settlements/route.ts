export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { arrayToCsv, centsToCsvNumber, dateToCsv, csvResponse } from '@/lib/csv'

export async function GET() {
  const settlements = await prisma.settlement.findMany({
    include: {
      delivery: { include: { supplier: true } },
      items: { include: { product: true } },
    },
    orderBy: { settledAt: 'desc' },
  })

  // Eine Zeile pro Abrechnungsposition (Produkt) für maximale Auswertbarkeit
  const headers = [
    'Abrechnungsdatum', 'Verkäufer', 'SKU', 'Produkt',
    'Menge verkauft', 'EK-Preis (€)', 'Gesamtbetrag (€)', 'Ø-Preis (€)',
    'Kosten (€)', 'Gewinn (€)', 'Marge (%)',
  ]
  const rows: (string | number)[][] = []
  for (const s of settlements) {
    for (const item of s.items) {
      const cost = item.quantitySold * item.product.purchasePriceCt
      const profit = item.totalAmountCt - cost
      const margin = item.totalAmountCt > 0 ? (profit / item.totalAmountCt) * 100 : 0
      const avg = item.quantitySold > 0 ? Math.round(item.totalAmountCt / item.quantitySold) : 0
      rows.push([
        dateToCsv(s.settledAt),
        s.delivery.supplier.name,
        item.product.sku,
        item.product.name,
        item.quantitySold,
        centsToCsvNumber(item.product.purchasePriceCt),
        centsToCsvNumber(item.totalAmountCt),
        centsToCsvNumber(avg),
        centsToCsvNumber(cost),
        centsToCsvNumber(profit),
        margin.toFixed(1).replace('.', ','),
      ])
    }
  }

  return csvResponse(arrayToCsv(headers, rows), 'abrechnungen.csv')
}
