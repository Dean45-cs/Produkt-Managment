import crypto from 'crypto'

/**
 * Verkäufer-Anmeldung: Link-Token (kommt vom Owner) + optionaler PIN.
 * Der PIN-Hash wird vom Owner erzeugt und über den Sync hierher übertragen –
 * wir prüfen ihn nur. Nach korrekter PIN-Eingabe setzen wir ein signiertes
 * Cookie (HMAC mit PORTAL_SESSION_SECRET).
 */

export const PORTAL_COOKIE = 'portal_session'

function secret(): string {
  return process.env.PORTAL_SESSION_SECRET || process.env.SYNC_SECRET || 'INSECURE-DEV-PORTAL-SESSION-SECRET'
}

/** Prüft einen PIN gegen `salt:hash` (scrypt, hex) – identisch zur Haupt-App. */
export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const derived = crypto.scryptSync(pin, salt, expected.length)
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export function signCookie(token: string): string {
  const sig = crypto.createHmac('sha256', secret()).update(token).digest('base64url')
  return `${token}.${sig}`
}

export function cookieMatches(cookieValue: string | undefined | null, token: string): boolean {
  if (!cookieValue) return false
  const dot = cookieValue.lastIndexOf('.')
  if (dot <= 0) return false
  const value = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b) && value === token
}
