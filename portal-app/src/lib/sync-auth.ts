import crypto from 'crypto'

/**
 * Schutz der Sync-Endpunkte: nur die Haupt-App (lokal beim Owner) darf pushen,
 * abrufen und bestätigen. Authentifizierung per gemeinsamem Geheimnis
 * (SYNC_SECRET) im Header `x-sync-secret`.
 */
export function checkSyncSecret(req: Request): boolean {
  const expected = process.env.SYNC_SECRET
  if (!expected) return false
  const got = req.headers.get('x-sync-secret') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
