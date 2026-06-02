import path from 'path'
import Database from 'better-sqlite3'
import { escapeKey } from '@/lib/db-encryption'
import { generateToken } from '@/lib/portal/auth'

/**
 * Separater "Portal-Eingang" – eine EIGENE verschlüsselte SQLite-Datei
 * (portal.db), unabhängig vom Master-verschlüsselten Hauptspeicher (dev.db).
 *
 * Warum getrennt? Damit Verkäufer ihre Verkäufe JEDERZEIT einreichen können –
 * auch wenn die Haupt-App gerade gesperrt ist (dann liegt der Master-Schlüssel
 * nicht im Speicher). Dieser Eingang nutzt einen eigenen Schlüssel
 * (PORTAL_SECRET / SESSION_SECRET) und ist daher immer beschreibbar.
 *
 * Inhalt:
 *  - seller:     Portal-Zugang je Verkäufer (Token für den Link + PIN-Hash).
 *  - open_item:  Spiegel der offenen Ladungen (damit der Verkäufer sie auch bei
 *                gesperrter App sieht). Wird bei jeder Entsperrung aufgefrischt.
 *  - submission: eingereichte Verkäufe. Werden – sobald die App entsperrt ist –
 *                automatisch in echte Abrechnungen (Settlement) gebucht.
 */

const PORTAL_DB_PATH = path.resolve(process.cwd(), 'portal.db')

function getKey(): string {
  return (
    process.env.PORTAL_SECRET ||
    process.env.SESSION_SECRET ||
    'INSECURE-DEV-PORTAL-SECRET-please-set-PORTAL_SECRET-in-env'
  )
}

interface Stmt {
  run: (...a: unknown[]) => unknown
  get: (...a: unknown[]) => unknown
  all: (...a: unknown[]) => unknown[]
}
interface RawDB {
  exec: (s: string) => unknown
  prepare: (s: string) => Stmt
  pragma: (s: string) => unknown
  transaction: <T>(fn: (...a: unknown[]) => T) => (...a: unknown[]) => T
}

const globalForPortal = globalThis as unknown as { __pmsPortalDb?: RawDB }

function init(): RawDB {
  const db = new Database(PORTAL_DB_PATH) as unknown as RawDB
  // PRAGMA key MUSS die erste Anweisung sein (SQLCipher).
  db.pragma(`key='${escapeKey(getKey())}'`)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller (
      supplier_id TEXT PRIMARY KEY,
      token       TEXT UNIQUE,
      pin_hash    TEXT,
      enabled     INTEGER NOT NULL DEFAULT 0,
      name        TEXT,
      updated_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS open_item (
      delivery_id        TEXT NOT NULL,
      product_id         TEXT NOT NULL,
      supplier_id        TEXT NOT NULL,
      delivery_label     TEXT,
      delivery_date      TEXT,
      product_name       TEXT,
      quantity_open      INTEGER NOT NULL,
      suggested_price_ct INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (delivery_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS open_item_supplier ON open_item(supplier_id);
    CREATE TABLE IF NOT EXISTS submission (
      id            TEXT PRIMARY KEY,
      supplier_id   TEXT NOT NULL,
      token         TEXT NOT NULL,
      delivery_id   TEXT NOT NULL,
      delivery_label TEXT,
      payload_json  TEXT NOT NULL,
      reported_at   TEXT,
      note          TEXT,
      status        TEXT NOT NULL DEFAULT 'PENDING',
      settlement_id TEXT,
      error         TEXT,
      created_at    TEXT NOT NULL,
      applied_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS submission_status ON submission(status);
    CREATE INDEX IF NOT EXISTS submission_supplier ON submission(supplier_id);
  `)
  return db
}

function db(): RawDB {
  if (!globalForPortal.__pmsPortalDb) globalForPortal.__pmsPortalDb = init()
  return globalForPortal.__pmsPortalDb
}

// ---------- Verkäufer-Zugang ----------

export interface SellerRow {
  supplierId: string
  token: string | null
  pinHash: string | null
  enabled: boolean
  name: string | null
  updatedAt: string
}

interface SellerDbRow {
  supplier_id: string
  token: string | null
  pin_hash: string | null
  enabled: number
  name: string | null
  updated_at: string
}

function mapSeller(r: SellerDbRow | undefined): SellerRow | null {
  if (!r) return null
  return {
    supplierId: r.supplier_id,
    token: r.token,
    pinHash: r.pin_hash,
    enabled: r.enabled === 1,
    name: r.name,
    updatedAt: r.updated_at,
  }
}

export function getSellerBySupplierId(supplierId: string): SellerRow | null {
  return mapSeller(db().prepare('SELECT * FROM seller WHERE supplier_id = ?').get(supplierId) as SellerDbRow | undefined)
}

export function getSellerByToken(token: string): SellerRow | null {
  if (!token) return null
  return mapSeller(db().prepare('SELECT * FROM seller WHERE token = ?').get(token) as SellerDbRow | undefined)
}

export function listEnabledSellers(): SellerRow[] {
  const rows = db().prepare('SELECT * FROM seller WHERE enabled = 1').all() as SellerDbRow[]
  return rows.map((r) => mapSeller(r)!).filter(Boolean)
}

/** Stellt sicher, dass eine Zeile existiert (ohne Auth zu verändern) und aktualisiert den Namen. */
export function ensureSeller(supplierId: string, name: string | null): SellerRow {
  const now = new Date().toISOString()
  db().prepare(
    `INSERT INTO seller (supplier_id, name, enabled, updated_at) VALUES (?, ?, 0, ?)
     ON CONFLICT(supplier_id) DO UPDATE SET name = excluded.name`
  ).run(supplierId, name, now)
  return getSellerBySupplierId(supplierId)!
}

/** Aktiviert das Portal für einen Verkäufer; erzeugt bei Bedarf einen Link-Token. */
export function enableSeller(supplierId: string, name: string | null): SellerRow {
  const existing = getSellerBySupplierId(supplierId)
  const token = existing?.token || generateToken()
  const now = new Date().toISOString()
  db().prepare(
    `INSERT INTO seller (supplier_id, token, name, enabled, updated_at) VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(supplier_id) DO UPDATE SET token = excluded.token, name = excluded.name, enabled = 1, updated_at = excluded.updated_at`
  ).run(supplierId, token, name, now)
  return getSellerBySupplierId(supplierId)!
}

export function disableSeller(supplierId: string): void {
  db().prepare('UPDATE seller SET enabled = 0, updated_at = ? WHERE supplier_id = ?').run(new Date().toISOString(), supplierId)
}

/** Erzeugt einen neuen Token (macht den alten Link ungültig). */
export function regenerateToken(supplierId: string): SellerRow {
  const token = generateToken()
  db().prepare('UPDATE seller SET token = ?, updated_at = ? WHERE supplier_id = ?').run(token, new Date().toISOString(), supplierId)
  return getSellerBySupplierId(supplierId)!
}

export function setPin(supplierId: string, pinHash: string): void {
  db().prepare('UPDATE seller SET pin_hash = ?, updated_at = ? WHERE supplier_id = ?').run(pinHash, new Date().toISOString(), supplierId)
}

export function clearPin(supplierId: string): void {
  db().prepare('UPDATE seller SET pin_hash = NULL, updated_at = ? WHERE supplier_id = ?').run(new Date().toISOString(), supplierId)
}

// ---------- Spiegel der offenen Ladungen ----------

export interface OpenItemRow {
  deliveryId: string
  productId: string
  supplierId: string
  deliveryLabel: string | null
  deliveryDate: string | null
  productName: string | null
  quantityOpen: number
  suggestedPriceCt: number
}

interface OpenItemDbRow {
  delivery_id: string
  product_id: string
  supplier_id: string
  delivery_label: string | null
  delivery_date: string | null
  product_name: string | null
  quantity_open: number
  suggested_price_ct: number
}

export function replaceOpenItems(supplierId: string, items: OpenItemRow[]): void {
  const d = db()
  const del = d.prepare('DELETE FROM open_item WHERE supplier_id = ?')
  const ins = d.prepare(
    `INSERT OR REPLACE INTO open_item
       (delivery_id, product_id, supplier_id, delivery_label, delivery_date, product_name, quantity_open, suggested_price_ct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const tx = d.transaction(() => {
    del.run(supplierId)
    for (const it of items) {
      ins.run(
        it.deliveryId, it.productId, it.supplierId, it.deliveryLabel,
        it.deliveryDate, it.productName, it.quantityOpen, it.suggestedPriceCt
      )
    }
  })
  tx()
}

export function getOpenItems(supplierId: string): OpenItemRow[] {
  const rows = db().prepare(
    'SELECT * FROM open_item WHERE supplier_id = ? AND quantity_open > 0 ORDER BY delivery_date ASC, delivery_id ASC'
  ).all(supplierId) as OpenItemDbRow[]
  return rows.map((r) => ({
    deliveryId: r.delivery_id,
    productId: r.product_id,
    supplierId: r.supplier_id,
    deliveryLabel: r.delivery_label,
    deliveryDate: r.delivery_date,
    productName: r.product_name,
    quantityOpen: r.quantity_open,
    suggestedPriceCt: r.suggested_price_ct,
  }))
}

// ---------- Einreichungen ----------

export type SubmissionStatus = 'PENDING' | 'APPLIED' | 'FAILED'

export interface SubmissionItem {
  productId: string
  productName: string
  quantitySold: number
  totalAmountCt: number
}

export interface SubmissionRow {
  id: string
  supplierId: string
  token: string
  deliveryId: string
  deliveryLabel: string | null
  items: SubmissionItem[]
  reportedAt: string | null
  note: string | null
  status: SubmissionStatus
  settlementId: string | null
  error: string | null
  createdAt: string
  appliedAt: string | null
}

interface SubmissionDbRow {
  id: string
  supplier_id: string
  token: string
  delivery_id: string
  delivery_label: string | null
  payload_json: string
  reported_at: string | null
  note: string | null
  status: SubmissionStatus
  settlement_id: string | null
  error: string | null
  created_at: string
  applied_at: string | null
}

function mapSubmission(r: SubmissionDbRow | undefined): SubmissionRow | null {
  if (!r) return null
  let items: SubmissionItem[] = []
  try { items = JSON.parse(r.payload_json) } catch { items = [] }
  return {
    id: r.id,
    supplierId: r.supplier_id,
    token: r.token,
    deliveryId: r.delivery_id,
    deliveryLabel: r.delivery_label,
    items,
    reportedAt: r.reported_at,
    note: r.note,
    status: r.status,
    settlementId: r.settlement_id,
    error: r.error,
    createdAt: r.created_at,
    appliedAt: r.applied_at,
  }
}

export function insertSubmission(input: {
  id: string
  supplierId: string
  token: string
  deliveryId: string
  deliveryLabel: string | null
  items: SubmissionItem[]
  reportedAt: string | null
  note: string | null
}): void {
  db().prepare(
    `INSERT INTO submission
       (id, supplier_id, token, delivery_id, delivery_label, payload_json, reported_at, note, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`
  ).run(
    input.id, input.supplierId, input.token, input.deliveryId, input.deliveryLabel,
    JSON.stringify(input.items), input.reportedAt, input.note, new Date().toISOString()
  )
}

export function listPendingSubmissions(): SubmissionRow[] {
  const rows = db().prepare("SELECT * FROM submission WHERE status = 'PENDING' ORDER BY created_at ASC").all() as SubmissionDbRow[]
  return rows.map((r) => mapSubmission(r)!).filter(Boolean)
}

export function listSubmissions(limit = 200): SubmissionRow[] {
  const rows = db().prepare('SELECT * FROM submission ORDER BY created_at DESC LIMIT ?').all(limit) as SubmissionDbRow[]
  return rows.map((r) => mapSubmission(r)!).filter(Boolean)
}

export function listSubmissionsForSupplier(supplierId: string, limit = 20): SubmissionRow[] {
  const rows = db().prepare('SELECT * FROM submission WHERE supplier_id = ? ORDER BY created_at DESC LIMIT ?').all(supplierId, limit) as SubmissionDbRow[]
  return rows.map((r) => mapSubmission(r)!).filter(Boolean)
}

export function getSubmission(id: string): SubmissionRow | null {
  return mapSubmission(db().prepare('SELECT * FROM submission WHERE id = ?').get(id) as SubmissionDbRow | undefined)
}

export function markSubmissionApplied(id: string, settlementId: string): void {
  db().prepare("UPDATE submission SET status = 'APPLIED', settlement_id = ?, error = NULL, applied_at = ? WHERE id = ?")
    .run(settlementId, new Date().toISOString(), id)
}

export function markSubmissionFailed(id: string, error: string): void {
  db().prepare("UPDATE submission SET status = 'FAILED', error = ? WHERE id = ?").run(error.slice(0, 500), id)
}

export function countSubmissionsByStatus(): Record<SubmissionStatus, number> {
  const rows = db().prepare('SELECT status, COUNT(*) AS n FROM submission GROUP BY status').all() as { status: SubmissionStatus; n: number }[]
  const out: Record<SubmissionStatus, number> = { PENDING: 0, APPLIED: 0, FAILED: 0 }
  for (const r of rows) out[r.status] = r.n
  return out
}
