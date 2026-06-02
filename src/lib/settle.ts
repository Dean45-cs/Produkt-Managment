import type { PrismaClient } from '@/generated/prisma/client'
import { deliveryProgress, nextDeliveryStatus, DELIVERY_STATUS } from '@/lib/delivery'

/**
 * Gemeinsame Abrechnungs-Logik für eine Ladung. Erzeugt ein Settlement
 * (verkaufte Mengen + Beträge), prüft gegen die noch offenen Mengen und setzt
 * den Folgestatus der Ladung – alles in einer Transaktion (schützt vor
 * Race-Conditions bei gleichzeitigen Teilabrechnungen).
 *
 * Wird genutzt von:
 *  - der Owner-Route POST /api/deliveries/[id]/settle
 *  - der automatischen Verbuchung eingereichter Verkäufe aus dem Portal
 */

export interface SettleItemInput {
  productId: string
  quantitySold: number
  totalAmountCt: number
}

export interface CreateSettlementInput {
  settledAt?: string | Date | null
  notes?: string | null
  items: SettleItemInput[]
}

/** Fachlicher Fehler mit HTTP-Status (z.B. "mehr verkauft als offen"). */
export class SettlementError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'SettlementError'
    this.statusCode = statusCode
  }
}

export async function createSettlement(
  prisma: PrismaClient,
  deliveryId: string,
  input: CreateSettlementInput
) {
  // Nur Positionen mit verkaufter Menge zählen als (Teil-)Abrechnung.
  const items = (input.items || []).filter((i) => i.quantitySold > 0)
  if (!items.length) throw new SettlementError('Mindestens eine verkaufte Position erforderlich', 400)
  if (items.some((i) => i.totalAmountCt < 0)) throw new SettlementError('Betrag darf nicht negativ sein', 400)

  return prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        items: { include: { product: true } },
        settlements: { include: { items: true } },
        returns: { include: { items: true } },
      },
    })
    if (!delivery) throw new SettlementError('Ladung nicht gefunden', 404)
    if (delivery.status === DELIVERY_STATUS.PENDING) {
      throw new SettlementError('Ladung muss zuerst an den Verkäufer übergeben werden', 400)
    }
    if (delivery.status === DELIVERY_STATUS.CANCELLED) {
      throw new SettlementError('Stornierte Ladung kann nicht abgerechnet werden', 400)
    }

    const progress = deliveryProgress(delivery)
    const openByProduct = new Map(progress.perProduct.map((p) => [p.productId, p]))
    for (const item of items) {
      const p = openByProduct.get(item.productId)
      if (!p) throw new SettlementError(`Produkt ${item.productId} ist nicht Teil dieser Lieferung`, 400)
      if (item.quantitySold > p.quantityOpen) {
        throw new SettlementError(
          `Zu viele Stück für "${p.productName}": offen sind nur ${p.quantityOpen}, abgerechnet werden sollen ${item.quantitySold}`,
          400
        )
      }
    }

    const totalAmountCt = items.reduce((s, i) => s + i.totalAmountCt, 0)
    const settlement = await tx.settlement.create({
      data: {
        deliveryId,
        settledAt: input.settledAt ? new Date(input.settledAt) : new Date(),
        totalAmountCt,
        notes: input.notes ?? undefined,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantitySold: i.quantitySold,
            totalAmountCt: i.totalAmountCt,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    })

    const newProgress = deliveryProgress({
      items: delivery.items,
      settlements: [...delivery.settlements, { items }],
      returns: delivery.returns,
    })
    const status = nextDeliveryStatus(delivery.status, newProgress.totalOpen, true)
    await tx.delivery.update({ where: { id: deliveryId }, data: { status } })

    return settlement
  })
}
