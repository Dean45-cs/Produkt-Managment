import { prisma } from '@/lib/prisma'
import { arrayToCsv, dateToCsv, csvResponse } from '@/lib/csv'

export async function GET() {
  const reviews = await prisma.review.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  })

  const headers = ['Datum', 'SKU', 'Produkt', 'Sterne', 'Kunde', 'Kommentar']
  const rows: (string | number)[][] = reviews.map((r) => [
    dateToCsv(r.createdAt),
    r.product.sku,
    r.product.name,
    r.rating,
    r.customerName || '',
    r.comment || '',
  ])

  return csvResponse(arrayToCsv(headers, rows), 'bewertungen.csv')
}
