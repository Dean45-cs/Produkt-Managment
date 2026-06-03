export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSellerByToken, getOpenDeliveries, listRecentSubmissions, logAccess } from '@/lib/data'
import { PORTAL_COOKIE, cookieMatches } from '@/lib/auth'
import { clientInfo } from '@/lib/client-info'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const seller = await getSellerByToken(token)
  if (!seller || !seller.enabled) return NextResponse.json({ ok: false }, { status: 404 })

  // Zugriff protokollieren (für den Verkäufer unsichtbar).
  const info = clientInfo(req)
  void logAccess({ supplierRef: seller.supplierRef, token, event: 'OPEN', ip: info.ip, userAgent: info.userAgent })

  const requiresPin = !!seller.pinHash
  const cookie = cookies().get(PORTAL_COOKIE)?.value
  const authed = !requiresPin || cookieMatches(cookie, token)
  if (!authed) {
    return NextResponse.json({ ok: true, name: seller.name, requiresPin: true, authed: false })
  }

  const [deliveries, recentSubmissions] = await Promise.all([
    getOpenDeliveries(seller.supplierRef),
    listRecentSubmissions(seller.supplierRef, 10),
  ])
  return NextResponse.json({ ok: true, name: seller.name, requiresPin, authed: true, deliveries, recentSubmissions })
}
