export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPrismaOrNull } from '@/lib/vault'
import { rebookSubmission } from '@/lib/portal/sync'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prisma = getPrismaOrNull()
  if (!prisma) return NextResponse.json({ error: 'App ist gesperrt' }, { status: 401 })

  const sub = await rebookSubmission(prisma, id)
  if (!sub) return NextResponse.json({ error: 'Einreichung nicht gefunden' }, { status: 404 })

  return NextResponse.json({
    ok: sub.status === 'BOOKED',
    status: sub.status,
    settlementId: sub.settlementId,
    error: sub.error,
  })
}
