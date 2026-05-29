import { NextResponse } from 'next/server'
import { lock } from '@/lib/vault'
import { SESSION_COOKIE } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  await lock()
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
