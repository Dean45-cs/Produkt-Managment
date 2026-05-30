import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { touch, getSessionToken, getIdleTimeoutMs } from '@/lib/vault'
import { verifySession, signSession, SESSION_COOKIE } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Heartbeat bei echter Nutzeraktivität: verlängert die Sitzung und frischt das
 * Cookie auf. Wird vom Client gedrosselt (max. 1×/Minute) aufgerufen.
 */
export async function POST() {
  const cookieValue = cookies().get(SESSION_COOKIE)?.value
  const token = verifySession(cookieValue)
  if (!token || token !== getSessionToken()) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  if (!touch()) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  const idleMs = getIdleTimeoutMs()
  res.cookies.set(SESSION_COOKIE, signSession(token), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    ...(idleMs > 0 ? { maxAge: Math.floor(idleMs / 1000) } : {}),
  })
  return res
}
