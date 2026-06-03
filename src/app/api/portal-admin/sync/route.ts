export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPrismaOrNull } from '@/lib/vault'
import { runSync } from '@/lib/portal/sync'

/** Manuell mit der Portal-App synchronisieren ("Jetzt abrufen"). */
export async function POST() {
  const prisma = getPrismaOrNull()
  if (!prisma) return NextResponse.json({ error: 'App ist gesperrt' }, { status: 401 })
  try {
    const summary = await runSync(prisma)
    return NextResponse.json(summary)
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'Sync fehlgeschlagen' }, { status: 502 })
  }
}
