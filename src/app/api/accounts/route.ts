export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'
import { ACCOUNT_KIND, accountBalances } from '@/lib/accounts'

/**
 * Konten mit ihrem aktuellen Saldo. Zusätzlich das, was noch nicht verbucht
 * ist: Abrechnungen, für die noch kein Geld eingetragen wurde, und
 * Bestellungen ohne Ausgabe. Gebucht wird davon nichts — die Seite bietet es
 * nur zum Anklicken an.
 */
export async function GET() {
  const [accounts, sums, unbookedSettlements, unbookedOrders] = await Promise.all([
    prisma.account.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.bookEntry.groupBy({ by: ['accountId'], _sum: { amountCt: true } }),
    prisma.settlement.findMany({
      where: { bookEntries: { none: {} } },
      include: { delivery: { include: { supplier: true } } },
      orderBy: { settledAt: 'desc' },
      take: 50,
    }),
    prisma.purchaseOrder.findMany({
      where: { bookEntries: { none: {} }, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'] } },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const balances = accountBalances(
    sums.map((s) => ({ accountId: s.accountId, amountCt: s._sum.amountCt ?? 0 }))
  )

  return NextResponse.json({
    accounts: accounts.map((a) => ({ ...a, balanceCt: balances.get(a.id) ?? 0 })),
    totals: {
      cashCt: accounts
        .filter((a) => !a.isReserve)
        .reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0),
      reserveCt: accounts
        .filter((a) => a.isReserve)
        .reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0),
    },
    unbookedSettlements: unbookedSettlements.map((s) => ({
      id: s.id,
      settledAt: s.settledAt,
      totalAmountCt: s.totalAmountCt,
      sellerName: s.delivery.supplier.name,
    })),
    unbookedOrders: unbookedOrders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      orderedAt: o.orderedAt,
      supplierName: o.supplier?.name ?? null,
      totalCt: o.items.reduce((sum, i) => sum + i.quantityOrdered * i.unitPriceCt, 0),
    })),
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, kind, isReserve, notes, sortOrder } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  if (kind !== undefined && kind !== ACCOUNT_KIND.CASH && kind !== ACCOUNT_KIND.BANK) {
    return NextResponse.json({ error: 'Kontoart muss Kasse oder Bank sein' }, { status: 400 })
  }

  try {
    const account = await prisma.account.create({
      data: {
        name: name.trim(),
        kind: kind ?? ACCOUNT_KIND.CASH,
        isReserve: Boolean(isReserve),
        notes: notes || null,
        sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      },
    })
    return NextResponse.json(account, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
