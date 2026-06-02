import type { PrismaClient } from '@/generated/prisma/client'
import { getPrismaOrNull } from '@/lib/vault'
import { deliveryProgress, DELIVERY_STATUS } from '@/lib/delivery'
import { createSettlement, SettlementError } from '@/lib/settle'
import {
  listEnabledSellers,
  ensureSeller,
  replaceOpenItems,
  listPendingSubmissions,
  getSubmission,
  markSubmissionApplied,
  markSubmissionFailed,
  type OpenItemRow,
  type SubmissionRow,
} from '@/lib/portal/store'

/**
 * Bindeglied zwischen Portal-Eingang (portal.db) und Hauptdaten (dev.db).
 *
 * - syncPortalMirror: frischt den Spiegel der offenen Ladungen auf, damit
 *   Verkäufer sie auch bei gesperrter App sehen.
 * - drainSubmissions: bucht eingereichte Verkäufe automatisch in echte
 *   Abrechnungen (sobald die App entsperrt ist).
 * - runPortalMaintenance: führt beides aus, wenn die App gerade entsperrt ist;
 *   no-op bei gesperrter App (dann bleiben Einreichungen einfach im Eingang).
 */

const OPEN_STATUSES = [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.PARTIALLY_SETTLED]

function formatLabel(date: Date): string {
  return `Übergabe ${date.toLocaleDateString('de-DE')}`
}

/** Baut den Spiegel der offenen Posten für genau einen Verkäufer neu auf. */
export async function syncSeller(prisma: PrismaClient, supplierId: string): Promise<void> {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (supplier) ensureSeller(supplierId, supplier.name)

  const deliveries = await prisma.delivery.findMany({
    where: { supplierId, status: { in: OPEN_STATUSES } },
    include: {
      items: { include: { product: true } },
      settlements: { include: { items: true } },
      returns: { include: { items: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const openItems: OpenItemRow[] = []
  for (const d of deliveries) {
    const prog = deliveryProgress(d)
    const refDate = d.deliveryDate ?? d.createdAt
    for (const p of prog.perProduct) {
      if (p.quantityOpen <= 0) continue
      const di = d.items.find((x) => x.productId === p.productId)
      openItems.push({
        deliveryId: d.id,
        productId: p.productId,
        supplierId,
        deliveryLabel: formatLabel(refDate),
        deliveryDate: refDate.toISOString(),
        productName: p.productName,
        quantityOpen: p.quantityOpen,
        suggestedPriceCt: di?.expectedPriceCt ?? 0,
      })
    }
  }
  replaceOpenItems(supplierId, openItems)
}

/** Frischt den Spiegel für ALLE aktiven Portal-Verkäufer auf. */
export async function syncPortalMirror(prisma: PrismaClient): Promise<void> {
  for (const seller of listEnabledSellers()) {
    await syncSeller(prisma, seller.supplierId)
  }
}

function portalNote(sub: SubmissionRow): string {
  const base = 'Vom Verkäufer über das Portal eingereicht'
  return sub.note ? `${base}: ${sub.note}` : base
}

/** Bucht alle offenen Einreichungen in echte Abrechnungen. */
export async function drainSubmissions(prisma: PrismaClient): Promise<{ applied: number; failed: number }> {
  let applied = 0
  let failed = 0
  for (const sub of listPendingSubmissions()) {
    try {
      const settlement = await createSettlement(prisma, sub.deliveryId, {
        settledAt: sub.reportedAt,
        notes: portalNote(sub),
        items: sub.items.map((i) => ({
          productId: i.productId,
          quantitySold: i.quantitySold,
          totalAmountCt: i.totalAmountCt,
        })),
      })
      markSubmissionApplied(sub.id, settlement.id)
      applied++
    } catch (err) {
      const msg = err instanceof SettlementError ? err.message : (err as Error)?.message || 'Unbekannter Fehler'
      markSubmissionFailed(sub.id, msg)
      failed++
    }
  }
  return { applied, failed }
}

/** Bucht genau eine Einreichung nach (z.B. nach manuellem "Erneut versuchen"). */
export async function applySubmission(prisma: PrismaClient, id: string): Promise<SubmissionRow | null> {
  const sub = getSubmission(id)
  if (!sub) return null
  if (sub.status === 'APPLIED') return sub
  try {
    const settlement = await createSettlement(prisma, sub.deliveryId, {
      settledAt: sub.reportedAt,
      notes: portalNote(sub),
      items: sub.items.map((i) => ({
        productId: i.productId,
        quantitySold: i.quantitySold,
        totalAmountCt: i.totalAmountCt,
      })),
    })
    markSubmissionApplied(sub.id, settlement.id)
    await syncSeller(prisma, sub.supplierId)
  } catch (err) {
    const msg = err instanceof SettlementError ? err.message : (err as Error)?.message || 'Unbekannter Fehler'
    markSubmissionFailed(sub.id, msg)
  }
  return getSubmission(id)
}

/**
 * Führt Verbuchung + Spiegel-Auffrischung aus, sofern die App entsperrt ist.
 * Bei gesperrter App: no-op (Einreichungen bleiben im Eingang und werden beim
 * nächsten Entsperren automatisch verbucht).
 */
export async function runPortalMaintenance(): Promise<{ unlocked: boolean; applied: number; failed: number }> {
  const prisma = getPrismaOrNull()
  if (!prisma) return { unlocked: false, applied: 0, failed: 0 }
  try {
    const res = await drainSubmissions(prisma)
    await syncPortalMirror(prisma)
    return { unlocked: true, ...res }
  } catch {
    return { unlocked: true, applied: 0, failed: 0 }
  }
}
