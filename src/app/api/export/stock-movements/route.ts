export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { arrayToCsv, dateToCsv, csvResponse } from '@/lib/csv'

const REASON_LABELS: Record<string, string> = {
  INITIAL_STOCK: 'Anfangsbestand',
  PURCHASE_RECEIVED: 'Wareneingang',
  MANUAL_CORRECTION: 'Manuelle Korrektur',
  DAMAGED: 'Beschädigt',
  EXPIRED: 'Abgelaufen',
  FOUND: 'Gefunden',
  RETURN_FROM_SUPPLIER: 'Retoure',
  DELIVERY_RECEIVED: 'Wareneingang (alt)',
  DELIVERY_CANCELLED: 'Storno Ladung',
  SALE: 'Verkauf (alt)',
  DELIVERY_SENT: 'An Verkäufer übergeben',
  OTHER: 'Sonstiges',
}

export async function GET() {
  const movements = await prisma.stockAdjustment.findMany({
    include: { product: true, location: true },
    orderBy: { createdAt: 'desc' },
  })

  const headers = ['Datum', 'SKU', 'Produkt', 'Standort', 'Menge', 'Grund', 'Notiz']
  const rows = movements.map((m) => [
    dateToCsv(m.createdAt),
    m.product.sku,
    m.product.name,
    m.location.name,
    m.delta,
    REASON_LABELS[m.reason] ?? m.reason,
    m.note ?? '',
  ])

  return csvResponse(arrayToCsv(headers, rows), 'lagerbewegungen.csv')
}
