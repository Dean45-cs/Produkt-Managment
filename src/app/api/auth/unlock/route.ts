import { NextResponse } from 'next/server'
import { unlock, getSessionToken, dbFileExists } from '@/lib/vault'
import { signSession, SESSION_COOKIE } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 })
  }

  const firstRun = !dbFileExists()
  if (firstRun && password.length < 8) {
    return NextResponse.json({ error: 'Master-Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
  }

  const result = await unlock(password)
  if (!result.ok) {
    const msg = result.error === 'WRONG_PASSWORD' ? 'Falsches Passwort' : 'Datenbank konnte nicht entsperrt werden'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  const token = getSessionToken()
  if (!token) return NextResponse.json({ error: 'Session-Fehler' }, { status: 500 })

  const res = NextResponse.json({ ok: true, firstRun: result.firstRun })
  res.cookies.set(SESSION_COOKIE, signSession(token), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
