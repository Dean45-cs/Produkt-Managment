export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deliveryProgress } from '@/lib/delivery'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: true, location: true } },
      settlements: { include: { items: { include: { product: true } } }, orderBy: { settledAt: 'asc' } },
      returns: { include: { items: { include: { product: true, location: true } } } },
    },
  })
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(delivery)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { status, deliveryDate, notes } = body

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Erlaubte Statusübergänge – verhindert Rückwärtswechsel, die den Lagerbestand korrumpieren.
  if (status !== undefined && status !== delivery.status) {
    const ALLOWED: Record<string, string[]> = {
      PENDING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['CANCELLED'],
      PARTIALLY_SETTLED: ['CANCELLED'],
      SETTLED: [],
      CANCELLED: [],
    }
    const allowed = ALLOWED[delivery.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Ungültiger Statuswechsel: ${delivery.status} → ${status}` },
        { status: 400 }
      )
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Status innerhalb der Transaktion erneut lesen → schützt vor doppelter
      // Buchung bei gleichzeitigen Anfragen (Race Condition).
      const current = await tx.delivery.findUnique({ where: { id }, include: { items: true } })
      if (!current) throw Object.assign(new Error('Not found'), { statusCode: 404 })

      // Beim Markieren als GELIEFERT: Bestand prüfen und abbuchen.
      if (status === 'DELIVERED' && current.status === 'PENDING') {
        // Erst prüfen, ob an jedem Standort genug Bestand vorhanden ist.
        for (const item of current.items) {
          const inv = await tx.inventory.findUnique({
            where: { productId_locationId: { productId: item.productId, locationId: item.locationId } },
          })
          const available = inv?.quantity ?? 0
          if (available < item.quantitySent) {
            throw Object.assign(
              new Error(`Nicht genug Bestand für Produkt am Standort (verfügbar ${available}, benötigt ${item.quantitySent})`),
              { statusCode: 400 }
            )
          }
        }
        await tx.delivery.update({
          where: { id },
          data: { status, deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(), notes },
        })
        for (const item of current.items) {
          await tx.stockAdjustment.create({
            data: { productId: item.productId, locationId: item.locationId, delta: -item.quantitySent, reason: 'DELIVERY_SENT', note: `Lieferung ${id}` },
          })
          await tx.inventory.update({
            where: { productId_locationId: { productId: item.productId, locationId: item.locationId } },
            data: { quantity: { decrement: item.quantitySent } },
          })
        }
        return
      }

      // Beim Stornieren einer bereits gelieferten Lieferung: noch offene Menge
      // zurück ins Lager buchen (verkaufte/retournierte Menge bleibt abgebucht).
      if (status === 'CANCELLED' && (current.status === 'DELIVERED' || current.status === 'PARTIALLY_SETTLED')) {
        const full = await tx.delivery.findUnique({
          where: { id },
          include: {
            items: true,
            settlements: { include: { items: true } },
            returns: { include: { items: true } },
          },
        })
        const progress = deliveryProgress(full!)
        const openByProduct = new Map(progress.perProduct.map((p) => [p.productId, p.quantityOpen]))
        await tx.delivery.update({ where: { id }, data: { status, notes } })
        for (const item of current.items) {
          const open = openByProduct.get(item.productId) ?? 0
          if (open <= 0) continue
          await tx.stockAdjustment.create({
            data: { productId: item.productId, locationId: item.locationId, delta: open, reason: 'DELIVERY_CANCELLED', note: `Storno Lieferung ${id}` },
          })
          await tx.inventory.upsert({
            where: { productId_locationId: { productId: item.productId, locationId: item.locationId } },
            create: { productId: item.productId, locationId: item.locationId, quantity: open },
            update: { quantity: { increment: open } },
          })
        }
        return
      }

      // Sonstige Updates (Notizen, Datum, unkritische Statuswechsel).
      await tx.delivery.update({
        where: { id },
        data: { status, deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined, notes },
      })
    })
  } catch (err) {
    const e = err as { statusCode?: number; message?: string; code?: string }
    if (e.statusCode) return NextResponse.json({ error: e.message }, { status: e.statusCode })
    return handlePrismaError(err)
  }

  const updated = await prisma.delivery.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true, location: true } }, settlements: true },
  })
  return NextResponse.json(updated)
}
