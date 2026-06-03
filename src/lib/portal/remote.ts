import type { SubmissionItem } from '@/lib/portal/store'

/**
 * HTTP-Client zur gehosteten Portal-App (Vercel). Geschützt per gemeinsamem
 * Geheimnis (SYNC_SECRET) im Header. Konfiguration über Umgebungsvariablen:
 *  - PORTAL_BASE_URL: z.B. https://dein-portal.vercel.app
 *  - SYNC_SECRET:     identisch zur Portal-App
 */

function baseUrl(): string | null {
  const u = process.env.PORTAL_BASE_URL?.trim()
  return u ? u.replace(/\/$/, '') : null
}

function secret(): string {
  return process.env.SYNC_SECRET || ''
}

export function getPortalBaseUrl(): string | null {
  return baseUrl()
}

export function isSyncConfigured(): boolean {
  return !!baseUrl() && !!secret()
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const b = baseUrl()
  if (!b) throw new Error('PORTAL_BASE_URL ist nicht gesetzt')
  return fetch(b + path, {
    ...init,
    headers: { ...(init.headers || {}), 'content-type': 'application/json', 'x-sync-secret': secret() },
    cache: 'no-store',
  })
}

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

export async function pushSellers(sellers: PushSeller[]): Promise<void> {
  const r = await call('/api/sync/sellers', { method: 'POST', body: JSON.stringify({ sellers }) })
  if (!r.ok) throw new Error(`Push fehlgeschlagen (HTTP ${r.status})`)
}

export interface RemoteSubmission {
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

export async function pullSubmissions(): Promise<RemoteSubmission[]> {
  const r = await call('/api/sync/submissions', { method: 'GET' })
  if (!r.ok) throw new Error(`Abruf fehlgeschlagen (HTTP ${r.status})`)
  const data = await r.json().catch(() => ({}))
  return Array.isArray(data?.submissions) ? data.submissions : []
}

export interface AckResult {
  id: string
  bookStatus: 'BOOKED' | 'FAILED'
  settlementRef?: string | null
  error?: string | null
}

export async function ackSubmissions(results: AckResult[]): Promise<void> {
  if (results.length === 0) return
  const r = await call('/api/sync/ack', { method: 'POST', body: JSON.stringify({ results }) })
  if (!r.ok) throw new Error(`Bestätigung fehlgeschlagen (HTTP ${r.status})`)
}
