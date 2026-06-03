export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSellerByToken, getOpenDeliveries, listRecentSubmissions } from '@/lib/data'
import { PORTAL_COOKIE, cookieMatches } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const seller = await getSellerByToken(token)
  if (!seller || !seller.enabled) return NextResponse.json({ ok: false }, { status: 404 })

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
