import crypto from 'crypto'

/**
 * Signiertes Session-Cookie (HMAC-SHA256). Die Signatur verhindert, dass jemand
 * ein gültiges Cookie fälscht, ohne SESSION_SECRET zu kennen. Verifiziert wird
 * sowohl serverseitig als auch in der Edge-Middleware (siehe middleware.ts).
 */

export const SESSION_COOKIE = 'pms_session'

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    // Fallback nur für lokale Entwicklung; SESSION_SECRET sollte in .env gesetzt sein.
    return 'INSECURE-DEV-SECRET-please-set-SESSION_SECRET-in-env'
  }
  return s
}

/** Erzeugt `token.signature`. */
export function signSession(token: string): string {
  const sig = crypto.createHmac('sha256', getSecret()).update(token).digest('base64url')
  return `${token}.${sig}`
}

/** Prüft Signatur und gibt das Token zurück (oder null). */
export function verifySession(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null
  const dot = cookieValue.lastIndexOf('.')
  if (dot <= 0) return null
  const token = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  const expected = crypto.createHmac('sha256', getSecret()).update(token).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return crypto.timingSafeEqual(a, b) ? token : null
}
