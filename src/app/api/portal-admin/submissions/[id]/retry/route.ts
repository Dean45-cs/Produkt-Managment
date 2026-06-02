export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPrismaOrNull } from '@/lib/vault'
import { applySubmission } from '@/lib/portal/sync'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prisma = getPrismaOrNull()
  if (!prisma) return NextResponse.json({ error: 'App ist gesperrt' }, { status: 401 })

  const sub = await applySubmission(prisma, id)
  if (!sub) return NextResponse.json({ error: 'Einreichung nicht gefunden' }, { status: 404 })

  return NextResponse.json({
    ok: sub.status === 'APPLIED',
    status: sub.status,
    settlementId: sub.settlementId,
    error: sub.error,
  })
}
