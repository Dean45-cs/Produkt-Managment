export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'
import { ACCOUNT_KIND } from '@/lib/accounts'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  if (body.name !== undefined && !body.name?.trim()) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }
  if (
    body.kind !== undefined &&
    body.kind !== ACCOUNT_KIND.CASH &&
    body.kind !== ACCOUNT_KIND.BANK
  ) {
    return NextResponse.json({ error: 'Kontoart muss Kasse oder Bank sein' }, { status: 400 })
  }

  const data: { name?: string; kind?: string; isReserve?: boolean; notes?: string | null; sortOrder?: number } = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.kind !== undefined) data.kind = body.kind
  if (body.isReserve !== undefined) data.isReserve = Boolean(body.isReserve)
  if (body.notes !== undefined) data.notes = body.notes || null
  if (Number.isInteger(body.sortOrder)) data.sortOrder = body.sortOrder

  try {
    const account = await prisma.account.update({ where: { id }, data })
    return NextResponse.json(account)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Ein Konto mit Buchungen zu löschen würde den Verlauf zerreißen — dann
  // stimmt keine Summe mehr. Erst die Buchungen entfernen.
  const entryCount = await prisma.bookEntry.count({ where: { accountId: id } })
  if (entryCount > 0) {
    return NextResponse.json(
      { error: `Konto hat noch ${entryCount} Buchung${entryCount === 1 ? '' : 'en'} und kann nicht gelöscht werden` },
      { status: 409 }
    )
  }

  try {
    await prisma.account.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handlePrismaError(err)
  }
}
