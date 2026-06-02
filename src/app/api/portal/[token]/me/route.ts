export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getSellerByToken,
  getOpenItems,
  listSubmissionsForSupplier,
  type OpenItemRow,
} from '@/lib/portal/store'
import { PORTAL_COOKIE, portalCookieMatches } from '@/lib/portal/auth'

interface OpenDelivery {
  deliveryId: string
  label: string | null
  deliveryDate: string | null
  items: { productId: string; productName: string | null; quantityOpen: number; suggestedPriceCt: number }[]
}

function groupByDelivery(items: OpenItemRow[]): OpenDelivery[] {
  const map = new Map<string, OpenDelivery>()
  for (const it of items) {
    let d = map.get(it.deliveryId)
    if (!d) {
      d = { deliveryId: it.deliveryId, label: it.deliveryLabel, deliveryDate: it.deliveryDate, items: [] }
      map.set(it.deliveryId, d)
    }
    d.items.push({
      productId: it.productId,
      productName: it.productName,
      quantityOpen: it.quantityOpen,
      suggestedPriceCt: it.suggestedPriceCt,
    })
  }
  return Array.from(map.values())
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const seller = getSellerByToken(token)
  if (!seller || !seller.enabled) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  const requiresPin = !!seller.pinHash
  const cookie = cookies().get(PORTAL_COOKIE)?.value
  const authed = !requiresPin || portalCookieMatches(cookie, token)

  if (!authed) {
    return NextResponse.json({ ok: true, name: seller.name, requiresPin: true, authed: false })
  }

  const deliveries = groupByDelivery(getOpenItems(seller.supplierId))
  const recentSubmissions = listSubmissionsForSupplier(seller.supplierId, 10).map((s) => ({
    id: s.id,
    deliveryLabel: s.deliveryLabel,
    status: s.status,
    createdAt: s.createdAt,
    qty: s.items.reduce((a, i) => a + i.quantitySold, 0),
    totalCt: s.items.reduce((a, i) => a + i.totalAmountCt, 0),
    error: s.error,
  }))

  return NextResponse.json({
    ok: true,
    name: seller.name,
    requiresPin,
    authed: true,
    deliveries,
    recentSubmissions,
  })
}
