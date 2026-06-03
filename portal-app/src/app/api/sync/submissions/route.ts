export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { checkSyncSecret } from '@/lib/sync-auth'
import { listNewSubmissions } from '@/lib/data'

/** Haupt-App holt neue (noch nicht bestätigte) Einreichungen ab. */
export async function GET(req: Request) {
  if (!checkSyncSecret(req)) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const submissions = await listNewSubmissions()
  return NextResponse.json({ submissions })
}
