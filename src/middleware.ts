import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Zugangs-Gate: Jede Seite/Route erfordert ein gültig signiertes Session-Cookie.
 * Läuft im Edge-Runtime → nutzt Web Crypto (HMAC-SHA256), kein Node-`crypto`.
 *
 * Wichtig: Das eigentliche Daten-Schloss ist der Entschlüsselungs-Key im
 * Server-Speicher (siehe vault.ts). Dieses Gate verhindert Zugriff auf die
 * laufende, entsperrte App ohne gültige Session.
 */

const SESSION_COOKIE = 'pms_session'
// MUSS mit dem Fallback in src/lib/session.ts übereinstimmen.
const FALLBACK_SECRET = 'INSECURE-DEV-SECRET-please-set-SESSION_SECRET-in-env'

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  return s && s.length >= 16 ? s : FALLBACK_SECRET
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verifyCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return false
  const token = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
  const expected = bytesToB64url(new Uint8Array(mac))
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Öffentlich: Unlock-Seite + nur die nicht-schützenden Auth-Endpunkte.
  // /api/auth/lock ist NICHT öffentlich – sonst könnte jeder die App sperren.
  if (pathname === '/unlock' || pathname === '/api/auth/unlock' || pathname === '/api/auth/status') {
    return NextResponse.next()
  }

  const valid = await verifyCookie(req.cookies.get(SESSION_COOKIE)?.value)
  if (valid) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'LOCKED' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/unlock'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}
