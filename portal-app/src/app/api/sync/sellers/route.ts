export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { checkSyncSecret } from '@/lib/sync-auth'
import { upsertSeller, type PushSeller } from '@/lib/data'

/** Haupt-App pusht Verkäufer-Zugänge + offene Ware. */
export async function POST(req: Request) {
  if (!checkSyncSecret(req)) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const sellers: PushSeller[] = Array.isArray(body?.sellers) ? body.sellers : []
  for (const s of sellers) {
    if (!s?.supplierRef || !s?.token) continue
    await upsertSeller({
      supplierRef: s.supplierRef,
      token: s.token,
      pinHash: s.pinHash ?? null,
      enabled: s.enabled !== false,
      name: s.name ?? null,
      openItems: Array.isArray(s.openItems) ? s.openItems : [],
    })
  }
  return NextResponse.json({ ok: true, count: sellers.length })
}
