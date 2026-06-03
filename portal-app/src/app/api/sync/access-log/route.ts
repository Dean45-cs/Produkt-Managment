export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { checkSyncSecret } from '@/lib/sync-auth'
import { listAccessLog } from '@/lib/data'

/** Haupt-App holt das Zugriffs-Protokoll ab (optional je Verkäufer). */
export async function GET(req: Request) {
  if (!checkSyncSecret(req)) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const url = new URL(req.url)
  const supplierRef = url.searchParams.get('supplierRef') || undefined
  const limitRaw = url.searchParams.get('limit')
  const parsed = limitRaw ? parseInt(limitRaw, 10) : NaN
  const limit = Number.isFinite(parsed) ? parsed : undefined
  const entries = await listAccessLog({ supplierRef, limit })
  return NextResponse.json({ entries })
}
