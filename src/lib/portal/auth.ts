import crypto from 'crypto'
import { signSession, verifySession } from '@/lib/session'

/**
 * Zugang für Verkäufer im Portal: ein langer, nicht erratbarer Link-Token
 * (steckt in der URL /portal/<token>) plus optionaler PIN. Der PIN wird nur
 * als scrypt-Hash gespeichert, nie im Klartext.
 *
 * Nach korrekter PIN-Eingabe setzt das Portal ein eigenes, signiertes Cookie
 * (pms_portal = signiertes Token), damit der Verkäufer nicht bei jedem Schritt
 * den PIN neu eingeben muss.
 */

export const PORTAL_COOKIE = 'pms_portal'

/** Erzeugt einen URL-sicheren Zufalls-Token für den Verkäufer-Link. */
export function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/** Hash eines PINs: scrypt mit zufälligem Salt → `salt:hash` (beides hex). */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(pin, salt, 32)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

/** Prüft einen PIN gegen den gespeicherten `salt:hash`. */
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

/** Cookie-Wert für eine gültige Portal-Sitzung (signiertes Token). */
export function signPortalCookie(token: string): string {
  return signSession(token)
}

/** Liefert das in einem gültig signierten Portal-Cookie enthaltene Token (oder null). */
export function readPortalCookie(cookieValue: string | undefined | null): string | null {
  return verifySession(cookieValue)
}

/** Ist das Cookie für genau diesen Token gültig? */
export function portalCookieMatches(cookieValue: string | undefined | null, token: string): boolean {
  const v = readPortalCookie(cookieValue)
  return !!v && v === token
}
