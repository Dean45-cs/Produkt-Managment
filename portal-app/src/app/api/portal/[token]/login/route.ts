export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSellerByToken, logAccess } from '@/lib/data'
import { PORTAL_COOKIE, signCookie, verifyPin } from '@/lib/auth'
import { clientInfo } from '@/lib/client-info'

const attempts = new Map<string, { count: number; until: number }>()
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const seller = await getSellerByToken(token)
  if (!seller || !seller.enabled) return NextResponse.json({ error: 'Kein Zugang' }, { status: 404 })

  const now = Date.now()
  const rec = attempts.get(token)
  if (rec && rec.until > now) {
    return NextResponse.json({ error: 'Zu viele Fehlversuche – bitte kurz warten' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  const info = clientInfo(req)
  const ok = seller.pinHash ? verifyPin(pin, seller.pinHash) : true
  if (!ok) {
    const count = (rec?.count ?? 0) + 1
    attempts.set(token, { count: count % 5, until: count >= 5 ? now + 60_000 : 0 })
    void logAccess({ supplierRef: seller.supplierRef, token, event: 'LOGIN_FAIL', ip: info.ip, userAgent: info.userAgent })
    return NextResponse.json({ error: 'Falscher PIN' }, { status: 401 })
  }

  void logAccess({ supplierRef: seller.supplierRef, token, event: 'LOGIN_OK', ip: info.ip, userAgent: info.userAgent })
  attempts.delete(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PORTAL_COOKIE, signCookie(token), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  })
  return res
}
