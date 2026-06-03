export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { euroToCents } from '@/lib/money'
import { getSellerByToken, getOpenDeliveries, insertSubmission, type SubmissionItem } from '@/lib/data'
import { PORTAL_COOKIE, cookieMatches } from '@/lib/auth'

interface InputItem {
  productId: string
  quantitySold: number
  totalAmount?: number
  totalAmountCt?: number
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const seller = await getSellerByToken(token)
  if (!seller || !seller.enabled) return NextResponse.json({ error: 'Kein Zugang' }, { status: 404 })

  const requiresPin = !!seller.pinHash
  const cookie = cookies().get(PORTAL_COOKIE)?.value
  if (requiresPin && !cookieMatches(cookie, token)) {
    return NextResponse.json({ error: 'Bitte zuerst mit PIN anmelden' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const deliveryId: string = body?.deliveryId
  const note: string | null = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null
  const reportedAt: string | null = typeof body?.reportedAt === 'string' && body.reportedAt ? body.reportedAt : null
  const rawItems: InputItem[] = Array.isArray(body?.items) ? body.items : []
  if (!deliveryId) return NextResponse.json({ error: 'Ladung fehlt' }, { status: 400 })

  const deliveries = await getOpenDeliveries(seller.supplierRef)
  const delivery = deliveries.find((d) => d.deliveryId === deliveryId)
  if (!delivery) return NextResponse.json({ error: 'Diese Ladung ist nicht (mehr) offen' }, { status: 400 })
  const allowed = new Map(delivery.items.map((i) => [i.productId, i]))

  const items: SubmissionItem[] = []
  for (const raw of rawItems) {
    const qty = Number(raw.quantitySold)
    if (!Number.isInteger(qty) || qty <= 0) continue
    const open = allowed.get(raw.productId)
    if (!open) return NextResponse.json({ error: 'Produkt gehört nicht zu dieser Ladung' }, { status: 400 })
    if (qty > open.quantityOpen) {
      return NextResponse.json({ error: `Zu viele Stück für "${open.productName}": offen sind nur ${open.quantityOpen}` }, { status: 400 })
    }
    const totalAmountCt =
      typeof raw.totalAmountCt === 'number' ? Math.round(raw.totalAmountCt) : euroToCents(Number(raw.totalAmount) || 0)
    if (totalAmountCt < 0) return NextResponse.json({ error: 'Betrag darf nicht negativ sein' }, { status: 400 })
    items.push({ productId: raw.productId, productName: open.productName ?? '', quantitySold: qty, totalAmountCt })
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Bitte mindestens eine verkaufte Position eintragen' }, { status: 400 })
  }

  await insertSubmission({
    id: crypto.randomUUID(),
    supplierRef: seller.supplierRef,
    token,
    deliveryId,
    deliveryLabel: delivery.label,
    items,
    reportedAt,
    note,
  })

  return NextResponse.json({ ok: true, status: 'RECEIVED' })
}
