import type { SubmissionItem } from '@/lib/portal/store'
import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici'
import { socksDispatcher } from 'fetch-socks'

/**
 * HTTP-Client zur gehosteten Portal-App (Vercel). Geschützt per gemeinsamem
 * Geheimnis (SYNC_SECRET) im Header. Konfiguration über Umgebungsvariablen:
 *  - PORTAL_BASE_URL: z.B. https://dein-portal.vercel.app
 *  - SYNC_SECRET:     identisch zur Portal-App
 *  - SYNC_PROXY_URL:  optional. Leitet ALLE Sync-Anfragen über einen Proxy.
 *      Tor:        socks5://127.0.0.1:9050   (deine echte IP bleibt verborgen)
 *      HTTP-Proxy: http://127.0.0.1:8118
 *    So sieht die Portal-App / ihr Hoster nur die Proxy-/Tor-IP, nie deinen Rechner.
 */

let dispatcherCache: Dispatcher | null | undefined

/** Baut (einmalig) den Proxy-Dispatcher aus SYNC_PROXY_URL; ohne Variable: direkt. */
function getDispatcher(): Dispatcher | undefined {
  if (dispatcherCache !== undefined) return dispatcherCache ?? undefined
  const raw = process.env.SYNC_PROXY_URL?.trim()
  if (!raw) {
    dispatcherCache = null
    return undefined
  }
  try {
    const u = new URL(raw)
    if (u.protocol === 'socks5:' || u.protocol === 'socks:' || u.protocol === 'socks4:') {
      dispatcherCache = socksDispatcher({
        type: u.protocol === 'socks4:' ? 4 : 5,
        host: u.hostname,
        port: Number(u.port) || 9050,
      }) as unknown as Dispatcher
    } else {
      dispatcherCache = new ProxyAgent(raw)
    }
  } catch {
    dispatcherCache = null
  }
  return dispatcherCache ?? undefined
}

/** Läuft der Sync über einen Proxy (z.B. Tor)? */
export function isProxyConfigured(): boolean {
  return !!process.env.SYNC_PROXY_URL?.trim()
}

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
  const headers = { ...(init.headers || {}), 'content-type': 'application/json', 'x-sync-secret': secret() }
  const dispatcher = getDispatcher()
  if (dispatcher) {
    // Bei aktivem Proxy das fetch aus dem undici-Paket nutzen, damit fetch und
    // Dispatcher (fetch-socks) zur selben undici-Version gehören.
    return undiciFetch(b + path, { method: init.method, body: init.body as string | undefined, headers, dispatcher }) as unknown as Response
  }
  return fetch(b + path, { ...init, headers, cache: 'no-store' })
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

export interface AccessLogEntry {
  id: string
  supplierRef: string | null
  event: 'OPEN' | 'LOGIN_OK' | 'LOGIN_FAIL' | 'SUBMIT'
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export async function fetchAccessLog(params: { supplierRef?: string; limit?: number }): Promise<AccessLogEntry[]> {
  const qs = new URLSearchParams()
  if (params.supplierRef) qs.set('supplierRef', params.supplierRef)
  if (params.limit) qs.set('limit', String(params.limit))
  const r = await call(`/api/sync/access-log?${qs.toString()}`, { method: 'GET' })
  if (!r.ok) throw new Error(`Zugriffe konnten nicht geladen werden (HTTP ${r.status})`)
  const data = await r.json().catch(() => ({}))
  return Array.isArray(data?.entries) ? data.entries : []
}
