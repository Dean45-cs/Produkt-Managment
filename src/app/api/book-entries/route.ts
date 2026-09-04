export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'
import { ENTRY_KIND, buildTransfer, isValidCategory, isValidEntryKind, signedAmount } from '@/lib/accounts'
import { randomUUID } from 'crypto'

/** Buchungen, optional gefiltert nach Konto, Art und Zeitraum. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const accountId = sp.get('accountId')
  const kind = sp.get('kind')
  const from = sp.get('from')
  const to = sp.get('to')
  const limit = Math.min(Number(sp.get('limit')) || 200, 500)

  const bookedAt: { gte?: Date; lte?: Date } = {}
  if (from) bookedAt.gte = new Date(from)
  if (to) {
    // "bis" ist einschließlich des gewählten Tages.
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    bookedAt.lte = end
  }

  const entries = await prisma.bookEntry.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      ...(kind && isValidEntryKind(kind) ? { kind } : {}),
      ...(bookedAt.gte || bookedAt.lte ? { bookedAt } : {}),
    },
    include: {
      account: true,
      settlement: { include: { delivery: { include: { supplier: true } } } },
      purchaseOrder: { include: { supplier: true } },
    },
    orderBy: [{ bookedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })

  return NextResponse.json(entries)
}

/**
 * Legt eine Buchung an. Der Betrag wird immer positiv übergeben; das
 * Vorzeichen ergibt sich aus der Art. Eine Umbuchung erzeugt zwei
 * gespiegelte Zeilen in einer Transaktion, damit nie nur die halbe
 * Buchung in der Datenbank landet.
 */
export async function POST(req: Request) {
  const body = await req.json()
  const { kind, amountCt, bookedAt, note, category, accountId, fromAccountId, toAccountId, settlementId, purchaseOrderId } = body

  if (!isValidEntryKind(kind)) {
    return NextResponse.json({ error: 'Unbekannte Buchungsart' }, { status: 400 })
  }
  if (!Number.isInteger(amountCt) || amountCt <= 0) {
    return NextResponse.json({ error: 'Betrag muss größer als 0 sein' }, { status: 400 })
  }
  if (!isValidCategory(kind, category)) {
    return NextResponse.json({ error: 'Kategorie passt nicht zur Buchungsart' }, { status: 400 })
  }

  const when = bookedAt ? new Date(bookedAt) : new Date()
  if (isNaN(when.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 })
  }

  try {
    if (kind === ENTRY_KIND.TRANSFER) {
      if (!fromAccountId || !toAccountId) {
        return NextResponse.json({ error: 'Quell- und Zielkonto erforderlich' }, { status: 400 })
      }
      if (fromAccountId === toAccountId) {
        return NextResponse.json({ error: 'Quell- und Zielkonto müssen verschieden sein' }, { status: 400 })
      }
      const halves = buildTransfer({
        fromAccountId,
        toAccountId,
        amountCt,
        bookedAt: when,
        note: note || null,
        transferId: randomUUID(),
      })
      const created = await prisma.$transaction(halves.map((h) => prisma.bookEntry.create({ data: h })))
      return NextResponse.json(created, { status: 201 })
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Konto erforderlich' }, { status: 400 })
    }
    const entry = await prisma.bookEntry.create({
      data: {
        accountId,
        bookedAt: when,
        amountCt: signedAmount(kind, amountCt),
        kind,
        category: category || null,
        note: note || null,
        settlementId: settlementId || null,
        purchaseOrderId: purchaseOrderId || null,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
