import crypto from 'crypto'

/**
 * Erzeugung der Verkäufer-Zugangsdaten (Owner-Seite). Der Link-Token und der
 * PIN-Hash werden hier erzeugt und per Sync an die Portal-App übertragen, die
 * sie dann zur Anmeldung der Verkäufer nutzt.
 */

/** URL-sicherer Zufalls-Token für den Verkäufer-Link. */
export function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/** Hash eines PINs: scrypt mit zufälligem Salt → `salt:hash` (beides hex). */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(pin, salt, 32)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}
