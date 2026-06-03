/** Extrahiert IP und Geräte-/Browser-Kennung aus einer eingehenden Anfrage. */
export function clientInfo(req: Request): { ip: string | null; userAgent: string | null } {
  const xff = req.headers.get('x-forwarded-for')
  const ip = (xff ? xff.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || null
  const userAgent = req.headers.get('user-agent') || null
  return { ip, userAgent }
}
