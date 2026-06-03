export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { checkSyncSecret } from '@/lib/sync-auth'
import { ackSubmissions, type AckResult } from '@/lib/data'

/** Haupt-App meldet zurück, wie die Einreichungen verbucht wurden (für die Verkäufer-Anzeige). */
export async function POST(req: Request) {
  if (!checkSyncSecret(req)) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const results: AckResult[] = Array.isArray(body?.results) ? body.results : []
  await ackSubmissions(results)
  return NextResponse.json({ ok: true, count: results.length })
}
