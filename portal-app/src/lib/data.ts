import { q, withTx } from '@/lib/db'

export interface SellerRow {
  supplierRef: string
  token: string
  pinHash: string | null
  enabled: boolean
  name: string | null
}

export interface SubmissionItem {
  productId: string
  productName: string
  quantitySold: number
  totalAmountCt: number
}

export interface OpenDeliveryItem {
  productId: string
  productName: string | null
  quantityOpen: number
  suggestedPriceCt: number
}
export interface OpenDelivery {
  deliveryId: string
  label: string | null
  deliveryDate: string | null
  items: OpenDeliveryItem[]
}

// ---------- Verkäufer (öffentlich) ----------

export async function getSellerByToken(token: string): Promise<SellerRow | null> {
  if (!token) return null
  const rows = await q<{ supplier_ref: string; token: string; pin_hash: string | null; enabled: boolean; name: string | null }>(
    'SELECT supplier_ref, token, pin_hash, enabled, name FROM seller WHERE token = $1',
    [token]
  )
  const r = rows[0]
  if (!r) return null
  return { supplierRef: r.supplier_ref, token: r.token, pinHash: r.pin_hash, enabled: r.enabled, name: r.name }
}

export async function getOpenDeliveries(supplierRef: string): Promise<OpenDelivery[]> {
  const rows = await q<{
    delivery_id: string; product_id: string; delivery_label: string | null; delivery_date: string | null
    product_name: string | null; quantity_open: number; suggested_price_ct: number
  }>(
    `SELECT delivery_id, product_id, delivery_label, delivery_date, product_name, quantity_open, suggested_price_ct
       FROM open_item WHERE supplier_ref = $1 AND quantity_open > 0
       ORDER BY delivery_date ASC, delivery_id ASC`,
    [supplierRef]
  )
  const map = new Map<string, OpenDelivery>()
  for (const r of rows) {
    let d = map.get(r.delivery_id)
    if (!d) {
      d = { deliveryId: r.delivery_id, label: r.delivery_label, deliveryDate: r.delivery_date, items: [] }
      map.set(r.delivery_id, d)
    }
    d.items.push({
      productId: r.product_id,
      productName: r.product_name,
      quantityOpen: r.quantity_open,
      suggestedPriceCt: r.suggested_price_ct,
    })
  }
  return Array.from(map.values())
}

export interface RecentSubmission {
  id: string
  deliveryLabel: string | null
  displayStatus: 'RECEIVED' | 'BOOKED' | 'FAILED'
  qty: number
  totalCt: number
  bookError: string | null
  createdAt: string
}

export async function listRecentSubmissions(supplierRef: string, limit = 10): Promise<RecentSubmission[]> {
  const rows = await q<{
    id: string; delivery_label: string | null; payload_json: SubmissionItem[]
    book_status: string | null; book_error: string | null; created_at: Date
  }>(
    `SELECT id, delivery_label, payload_json, book_status, book_error, created_at
       FROM submission WHERE supplier_ref = $1 ORDER BY created_at DESC LIMIT $2`,
    [supplierRef, limit]
  )
  return rows.map((r) => {
    const items = Array.isArray(r.payload_json) ? r.payload_json : []
    return {
      id: r.id,
      deliveryLabel: r.delivery_label,
      displayStatus: r.book_status === 'BOOKED' ? 'BOOKED' : r.book_status === 'FAILED' ? 'FAILED' : 'RECEIVED',
      qty: items.reduce((a, i) => a + i.quantitySold, 0),
      totalCt: items.reduce((a, i) => a + i.totalAmountCt, 0),
      bookError: r.book_error,
      createdAt: new Date(r.created_at).toISOString(),
    }
  })
}

export async function insertSubmission(input: {
  id: string
  supplierRef: string
  token: string
  deliveryId: string
  deliveryLabel: string | null
  items: SubmissionItem[]
  reportedAt: string | null
  note: string | null
}): Promise<void> {
  await q(
    `INSERT INTO submission (id, supplier_ref, token, delivery_id, delivery_label, payload_json, reported_at, note)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      input.id, input.supplierRef, input.token, input.deliveryId, input.deliveryLabel,
      JSON.stringify(input.items), input.reportedAt, input.note,
    ]
  )
}

// ---------- Sync (nur Haupt-App) ----------

export interface PushOpenItem {
  deliveryId: string
  productId: string
  deliveryLabel: string | null
  deliveryDate: string | null
  productName: string | null
  quantityOpen: number
  suggestedPriceCt: number
}
export interface PushSeller {
  supplierRef: string
  token: string
  pinHash: string | null
  enabled: boolean
  name: string | null
  openItems: PushOpenItem[]
}

export async function upsertSeller(seller: PushSeller): Promise<void> {
  await withTx(async (c) => {
    await c.query(
      `INSERT INTO seller (supplier_ref, token, pin_hash, enabled, name, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (supplier_ref) DO UPDATE SET
         token = excluded.token, pin_hash = excluded.pin_hash,
         enabled = excluded.enabled, name = excluded.name, updated_at = now()`,
      [seller.supplierRef, seller.token, seller.pinHash, seller.enabled, seller.name]
    )
    await c.query('DELETE FROM open_item WHERE supplier_ref = $1', [seller.supplierRef])
    for (const it of seller.openItems) {
      await c.query(
        `INSERT INTO open_item (supplier_ref, delivery_id, product_id, delivery_label, delivery_date, product_name, quantity_open, suggested_price_ct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [seller.supplierRef, it.deliveryId, it.productId, it.deliveryLabel, it.deliveryDate, it.productName, it.quantityOpen, it.suggestedPriceCt]
      )
    }
  })
}

export interface NewSubmission {
  id: string
  supplierRef: string
  token: string
  deliveryId: string
  deliveryLabel: string | null
  items: SubmissionItem[]
  reportedAt: string | null
  note: string | null
  createdAt: string
}

export async function listNewSubmissions(): Promise<NewSubmission[]> {
  const rows = await q<{
    id: string; supplier_ref: string; token: string; delivery_id: string; delivery_label: string | null
    payload_json: SubmissionItem[]; reported_at: string | null; note: string | null; created_at: Date
  }>(
    `SELECT id, supplier_ref, token, delivery_id, delivery_label, payload_json, reported_at, note, created_at
       FROM submission WHERE portal_status = 'NEW' ORDER BY created_at ASC`
  )
  return rows.map((r) => ({
    id: r.id,
    supplierRef: r.supplier_ref,
    token: r.token,
    deliveryId: r.delivery_id,
    deliveryLabel: r.delivery_label,
    items: Array.isArray(r.payload_json) ? r.payload_json : [],
    reportedAt: r.reported_at,
    note: r.note,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}

export interface AckResult {
  id: string
  bookStatus: 'BOOKED' | 'FAILED'
  settlementRef?: string | null
  error?: string | null
}

export async function ackSubmissions(results: AckResult[]): Promise<void> {
  for (const r of results) {
    await q(
      `UPDATE submission SET portal_status = 'ACKED', book_status = $2, settlement_ref = $3, book_error = $4, acked_at = now()
       WHERE id = $1`,
      [r.id, r.bookStatus, r.settlementRef ?? null, r.error ?? null]
    )
  }
}

// ---------- Zugriffs-Protokoll (nur Owner sichtbar) ----------

export type AccessEvent = 'OPEN' | 'LOGIN_OK' | 'LOGIN_FAIL' | 'SUBMIT'

/** Best-effort: protokolliert einen Zugriff, ohne den normalen Ablauf zu stören. */
export async function logAccess(e: {
  supplierRef: string | null
  token: string | null
  event: AccessEvent
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  try {
    await q(
      'INSERT INTO access_log (supplier_ref, token, event, ip, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [e.supplierRef, e.token, e.event, e.ip, e.userAgent]
    )
  } catch {
    /* Logging darf nie den Hauptablauf brechen */
  }
}

export interface AccessLogEntry {
  id: string
  supplierRef: string | null
  event: AccessEvent
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export async function listAccessLog(opts: { supplierRef?: string; limit?: number }): Promise<AccessLogEntry[]> {
  const limit = Math.min(opts.limit ?? 200, 1000)
  const rows = opts.supplierRef
    ? await q<{ id: string; supplier_ref: string | null; event: AccessEvent; ip: string | null; user_agent: string | null; created_at: Date }>(
        'SELECT id, supplier_ref, event, ip, user_agent, created_at FROM access_log WHERE supplier_ref = $1 ORDER BY created_at DESC LIMIT $2',
        [opts.supplierRef, limit]
      )
    : await q<{ id: string; supplier_ref: string | null; event: AccessEvent; ip: string | null; user_agent: string | null; created_at: Date }>(
        'SELECT id, supplier_ref, event, ip, user_agent, created_at FROM access_log ORDER BY created_at DESC LIMIT $1',
        [limit]
      )
  return rows.map((r) => ({
    id: String(r.id),
    supplierRef: r.supplier_ref,
    event: r.event,
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}
