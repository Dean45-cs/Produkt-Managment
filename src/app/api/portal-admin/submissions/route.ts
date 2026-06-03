export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { listSubmissions, countSubmissionsByStatus, getSellerBySupplierId } from '@/lib/portal/store'
import { triggerSync } from '@/lib/portal/sync'

export async function GET() {
  // Beim Öffnen mit der Portal-App synchronisieren (abholen + verbuchen).
  const sync = await triggerSync()

  const nameCache = new Map<string, string | null>()
  const submissions = listSubmissions(300).map((s) => {
    if (!nameCache.has(s.supplierId)) {
      nameCache.set(s.supplierId, getSellerBySupplierId(s.supplierId)?.name ?? null)
    }
    return {
      id: s.id,
      supplierId: s.supplierId,
      sellerName: nameCache.get(s.supplierId) ?? null,
      deliveryId: s.deliveryId,
      deliveryLabel: s.deliveryLabel,
      status: s.status,
      settlementId: s.settlementId,
      error: s.error,
      reportedAt: s.reportedAt,
      createdAt: s.createdAt,
      bookedAt: s.bookedAt,
      note: s.note,
      qty: s.items.reduce((a, i) => a + i.quantitySold, 0),
      totalCt: s.items.reduce((a, i) => a + i.totalAmountCt, 0),
      items: s.items,
    }
  })

  return NextResponse.json({ submissions, counts: countSubmissionsByStatus(), sync })
}
