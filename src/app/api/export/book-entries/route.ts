export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { arrayToCsv, centsToCsvNumber, dateToCsv, csvResponse } from '@/lib/csv'
import { ENTRY_CATEGORY_LABELS, ENTRY_KIND_LABELS } from '@/lib/accounts'

export async function GET() {
  const entries = await prisma.bookEntry.findMany({
    include: {
      account: true,
      settlement: { include: { delivery: { include: { supplier: true } } } },
      purchaseOrder: { include: { supplier: true } },
    },
    orderBy: [{ bookedAt: 'desc' }, { createdAt: 'desc' }],
  })

  const headers = ['Datum', 'Konto', 'Art', 'Kategorie', 'Betrag (€)', 'Notiz', 'Bezug']
  const rows = entries.map((e) => [
    dateToCsv(e.bookedAt),
    e.account.name,
    ENTRY_KIND_LABELS[e.kind] ?? e.kind,
    e.category ? ENTRY_CATEGORY_LABELS[e.category] ?? e.category : '',
    centsToCsvNumber(e.amountCt),
    e.note ?? '',
    e.settlement
      ? `Abrechnung ${e.settlement.delivery.supplier.name}`
      : e.purchaseOrder
        ? `Bestellung ${e.purchaseOrder.supplier?.name ?? ''}`.trim()
        : '',
  ])

  return csvResponse(arrayToCsv(headers, rows), 'buchungen.csv')
}
