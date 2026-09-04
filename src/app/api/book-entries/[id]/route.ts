export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

/**
 * Löscht eine Buchung. Bei einer Umbuchung verschwinden beide Hälften
 * gemeinsam — sonst bliebe auf einem Konto Geld liegen, das auf dem anderen
 * schon abgezogen wurde.
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const entry = await prisma.bookEntry.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  try {
    if (entry.transferId) {
      const { count } = await prisma.bookEntry.deleteMany({ where: { transferId: entry.transferId } })
      return NextResponse.json({ ok: true, deleted: count })
    }
    await prisma.bookEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: 1 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
