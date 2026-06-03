import type { PrismaClient } from '@/generated/prisma/client'
import { getPrismaOrNull } from '@/lib/vault'
import { deliveryProgress, DELIVERY_STATUS } from '@/lib/delivery'
import { createSettlement, SettlementError } from '@/lib/settle'
import {
  listSellersWithToken,
  recordSubmission,
  getSubmission,
  hasSubmission,
  markBooked,
  markFailed,
  type SubmissionRow,
} from '@/lib/portal/store'
import {
  isSyncConfigured,
  pushSellers,
  pullSubmissions,
  ackSubmissions,
  type PushSeller,
  type PushOpenItem,
  type AckResult,
} from '@/lib/portal/remote'

/**
 * Sync zwischen lokaler Haupt-App und gehosteter Portal-App:
 *  1. PUSH: aktuelle Verkäufer-Zugänge + offene Ware hochladen.
 *  2. PULL: neue Einreichungen abholen.
 *  3. BOOK: lokal als Abrechnung verbuchen (gegen offene Mengen geprüft).
 *  4. ACK:  Ergebnis zurückmelden (damit der Verkäufer "verbucht" sieht).
 */

const OPEN_STATUSES = [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.PARTIALLY_SETTLED]

export interface SyncSummary {
  configured: boolean
  pushed: number
  pulled: number
  booked: number
  failed: number
  error?: string
}

function portalNote(note: string | null): string {
  const base = 'Vom Verkäufer über das Portal eingereicht'
  return note ? `${base}: ${note}` : base
}

async function computeOpenItems(prisma: PrismaClient, supplierId: string): Promise<PushOpenItem[]> {
  const deliveries = await prisma.delivery.findMany({
    where: { supplierId, status: { in: OPEN_STATUSES } },
    include: {
      items: { include: { product: true } },
      settlements: { include: { items: true } },
      returns: { include: { items: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const out: PushOpenItem[] = []
  for (const d of deliveries) {
    const prog = deliveryProgress(d)
    const refDate = d.deliveryDate ?? d.createdAt
    for (const p of prog.perProduct) {
      if (p.quantityOpen <= 0) continue
      const di = d.items.find((x) => x.productId === p.productId)
      out.push({
        deliveryId: d.id,
        productId: p.productId,
        deliveryLabel: `Übergabe ${refDate.toLocaleDateString('de-DE')}`,
        deliveryDate: refDate.toISOString(),
        productName: p.productName,
        quantityOpen: p.quantityOpen,
        suggestedPriceCt: di?.expectedPriceCt ?? 0,
      })
    }
  }
  return out
}

async function buildPushSellers(prisma: PrismaClient): Promise<PushSeller[]> {
  const out: PushSeller[] = []
  for (const s of listSellersWithToken()) {
    if (!s.token) continue
    const supplier = await prisma.supplier.findUnique({ where: { id: s.supplierId } })
    out.push({
      supplierRef: s.supplierId,
      token: s.token,
      pinHash: s.pinHash,
      enabled: s.enabled,
      name: supplier?.name ?? s.name,
      openItems: s.enabled ? await computeOpenItems(prisma, s.supplierId) : [],
    })
  }
  return out
}

export async function runSync(prisma: PrismaClient): Promise<SyncSummary> {
  if (!isSyncConfigured()) return { configured: false, pushed: 0, pulled: 0, booked: 0, failed: 0 }

  // 1) PUSH
  const sellers = await buildPushSellers(prisma)
  await pushSellers(sellers)

  // 2) PULL
  const incoming = await pullSubmissions()

  // 3) BOOK + 4) sammeln für ACK
  const acks: AckResult[] = []
  let booked = 0
  let failed = 0
  for (const sub of incoming) {
    if (hasSubmission(sub.id)) {
      const ex = getSubmission(sub.id)!
      acks.push({ id: sub.id, bookStatus: ex.status, settlementRef: ex.settlementId, error: ex.error })
      continue
    }
    const baseRow = {
      id: sub.id,
      supplierId: sub.supplierRef,
      deliveryId: sub.deliveryId,
      deliveryLabel: sub.deliveryLabel,
      items: sub.items,
      reportedAt: sub.reportedAt,
      note: sub.note,
      createdAt: sub.createdAt,
    }
    try {
      const settlement = await createSettlement(prisma, sub.deliveryId, {
        settledAt: sub.reportedAt,
        notes: portalNote(sub.note),
        items: sub.items.map((i) => ({ productId: i.productId, quantitySold: i.quantitySold, totalAmountCt: i.totalAmountCt })),
      })
      recordSubmission({ ...baseRow, status: 'BOOKED', settlementId: settlement.id, error: null, bookedAt: new Date().toISOString() })
      acks.push({ id: sub.id, bookStatus: 'BOOKED', settlementRef: settlement.id })
      booked++
    } catch (err) {
      const msg = err instanceof SettlementError ? err.message : (err as Error)?.message || 'Unbekannter Fehler'
      recordSubmission({ ...baseRow, status: 'FAILED', settlementId: null, error: msg, bookedAt: null })
      acks.push({ id: sub.id, bookStatus: 'FAILED', error: msg })
      failed++
    }
  }

  // 4) ACK
  await ackSubmissions(acks)

  return { configured: true, pushed: sellers.length, pulled: incoming.length, booked, failed }
}

/** Bucht eine zuvor fehlgeschlagene Einreichung erneut und meldet das Ergebnis zurück. */
export async function rebookSubmission(prisma: PrismaClient, id: string): Promise<SubmissionRow | null> {
  const sub = getSubmission(id)
  if (!sub) return null
  if (sub.status === 'BOOKED') return sub
  try {
    const settlement = await createSettlement(prisma, sub.deliveryId, {
      settledAt: sub.reportedAt,
      notes: portalNote(sub.note),
      items: sub.items.map((i) => ({ productId: i.productId, quantitySold: i.quantitySold, totalAmountCt: i.totalAmountCt })),
    })
    markBooked(id, settlement.id)
  } catch (err) {
    const msg = err instanceof SettlementError ? err.message : (err as Error)?.message || 'Unbekannter Fehler'
    markFailed(id, msg)
  }
  const updated = getSubmission(id)!
  if (isSyncConfigured()) {
    await ackSubmissions([{ id, bookStatus: updated.status, settlementRef: updated.settlementId, error: updated.error }]).catch(() => {})
  }
  return updated
}

/** Sync ausführen, sofern die App entsperrt ist. Fehler (z.B. Portal offline) werden abgefangen. */
export async function triggerSync(): Promise<SyncSummary & { unlocked: boolean }> {
  const prisma = getPrismaOrNull()
  if (!prisma) return { unlocked: false, configured: isSyncConfigured(), pushed: 0, pulled: 0, booked: 0, failed: 0 }
  try {
    const r = await runSync(prisma)
    return { unlocked: true, ...r }
  } catch (e) {
    return { unlocked: true, configured: isSyncConfigured(), pushed: 0, pulled: 0, booked: 0, failed: 0, error: (e as Error)?.message }
  }
}
