import path from 'path'
import Database from 'better-sqlite3'
import { escapeKey } from '@/lib/db-encryption'
import { generateToken } from '@/lib/portal/auth'

/**
 * Lokaler Owner-Speicher für das Verkäufer-Portal (getrennt vom Master-
 * verschlüsselten dev.db, eigener Schlüssel PORTAL_SECRET).
 *
 * Enthält:
 *  - seller:     Portal-Zugang je Verkäufer (Link-Token + PIN-Hash). Quelle der
 *                Wahrheit; wird per Sync an die Portal-App (Vercel) gepusht.
 *  - submission: lokales Protokoll der vom Portal abgeholten Einreichungen und
 *                wie sie verbucht wurden (BOOKED/FAILED).
 *
 * Die offene Ware wird NICHT hier gespiegelt – sie wird beim Sync direkt aus
 * dev.db berechnet und hochgeladen.
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
}

const globalForPortal = globalThis as unknown as { __pmsPortalDb?: RawDB }

function init(): RawDB {
  const db = new Database(PORTAL_DB_PATH) as unknown as RawDB
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
    CREATE TABLE IF NOT EXISTS submission (
      id             TEXT PRIMARY KEY,
      supplier_id    TEXT NOT NULL,
      delivery_id    TEXT NOT NULL,
      delivery_label TEXT,
      payload_json   TEXT NOT NULL,
      reported_at    TEXT,
      note           TEXT,
      status         TEXT NOT NULL,
      settlement_id  TEXT,
      error          TEXT,
      created_at     TEXT,
      booked_at      TEXT
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

/** Alle Verkäufer mit Portal-Token (aktiv oder zuletzt deaktiviert) – Push-Kandidaten. */
export function listSellersWithToken(): SellerRow[] {
  const rows = db().prepare('SELECT * FROM seller WHERE token IS NOT NULL').all() as SellerDbRow[]
  return rows.map((r) => mapSeller(r)!).filter(Boolean)
}

export function ensureSeller(supplierId: string, name: string | null): SellerRow {
  db().prepare(
    `INSERT INTO seller (supplier_id, name, enabled, updated_at) VALUES (?, ?, 0, ?)
     ON CONFLICT(supplier_id) DO UPDATE SET name = excluded.name`
  ).run(supplierId, name, new Date().toISOString())
  return getSellerBySupplierId(supplierId)!
}

export function enableSeller(supplierId: string, name: string | null): SellerRow {
  const existing = getSellerBySupplierId(supplierId)
  const token = existing?.token || generateToken()
  db().prepare(
    `INSERT INTO seller (supplier_id, token, name, enabled, updated_at) VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(supplier_id) DO UPDATE SET token = excluded.token, name = excluded.name, enabled = 1, updated_at = excluded.updated_at`
  ).run(supplierId, token, name, new Date().toISOString())
  return getSellerBySupplierId(supplierId)!
}

export function disableSeller(supplierId: string): void {
  db().prepare('UPDATE seller SET enabled = 0, updated_at = ? WHERE supplier_id = ?').run(new Date().toISOString(), supplierId)
}

export function regenerateToken(supplierId: string): SellerRow {
  db().prepare('UPDATE seller SET token = ?, updated_at = ? WHERE supplier_id = ?').run(generateToken(), new Date().toISOString(), supplierId)
  return getSellerBySupplierId(supplierId)!
}

export function setPin(supplierId: string, pinHash: string): void {
  db().prepare('UPDATE seller SET pin_hash = ?, updated_at = ? WHERE supplier_id = ?').run(pinHash, new Date().toISOString(), supplierId)
}

export function clearPin(supplierId: string): void {
  db().prepare('UPDATE seller SET pin_hash = NULL, updated_at = ? WHERE supplier_id = ?').run(new Date().toISOString(), supplierId)
}

// ---------- Einreichungs-Protokoll ----------

export type SubmissionStatus = 'BOOKED' | 'FAILED'

export interface SubmissionItem {
  productId: string
  productName: string
  quantitySold: number
  totalAmountCt: number
}

export interface SubmissionRow {
  id: string
  supplierId: string
  deliveryId: string
  deliveryLabel: string | null
  items: SubmissionItem[]
  reportedAt: string | null
  note: string | null
  status: SubmissionStatus
  settlementId: string | null
  error: string | null
  createdAt: string | null
  bookedAt: string | null
}

interface SubmissionDbRow {
  id: string
  supplier_id: string
  delivery_id: string
  delivery_label: string | null
  payload_json: string
  reported_at: string | null
  note: string | null
  status: SubmissionStatus
  settlement_id: string | null
  error: string | null
  created_at: string | null
  booked_at: string | null
}

function mapSubmission(r: SubmissionDbRow | undefined): SubmissionRow | null {
  if (!r) return null
  let items: SubmissionItem[] = []
  try { items = JSON.parse(r.payload_json) } catch { items = [] }
  return {
    id: r.id,
    supplierId: r.supplier_id,
    deliveryId: r.delivery_id,
    deliveryLabel: r.delivery_label,
    items,
    reportedAt: r.reported_at,
    note: r.note,
    status: r.status,
    settlementId: r.settlement_id,
    error: r.error,
    createdAt: r.created_at,
    bookedAt: r.booked_at,
  }
}

/** Schreibt/aktualisiert eine abgeholte Einreichung im lokalen Protokoll. */
export function recordSubmission(row: {
  id: string
  supplierId: string
  deliveryId: string
  deliveryLabel: string | null
  items: SubmissionItem[]
  reportedAt: string | null
  note: string | null
  status: SubmissionStatus
  settlementId: string | null
  error: string | null
  createdAt: string | null
  bookedAt: string | null
}): void {
  db().prepare(
    `INSERT INTO submission
       (id, supplier_id, delivery_id, delivery_label, payload_json, reported_at, note, status, settlement_id, error, created_at, booked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, settlement_id = excluded.settlement_id, error = excluded.error, booked_at = excluded.booked_at`
  ).run(
    row.id, row.supplierId, row.deliveryId, row.deliveryLabel, JSON.stringify(row.items),
    row.reportedAt, row.note, row.status, row.settlementId, row.error, row.createdAt, row.bookedAt
  )
}

export function getSubmission(id: string): SubmissionRow | null {
  return mapSubmission(db().prepare('SELECT * FROM submission WHERE id = ?').get(id) as SubmissionDbRow | undefined)
}

export function hasSubmission(id: string): boolean {
  return !!db().prepare('SELECT 1 FROM submission WHERE id = ?').get(id)
}

export function listSubmissions(limit = 300): SubmissionRow[] {
  const rows = db().prepare('SELECT * FROM submission ORDER BY created_at DESC LIMIT ?').all(limit) as SubmissionDbRow[]
  return rows.map((r) => mapSubmission(r)!).filter(Boolean)
}

export function markBooked(id: string, settlementId: string): void {
  db().prepare("UPDATE submission SET status = 'BOOKED', settlement_id = ?, error = NULL, booked_at = ? WHERE id = ?")
    .run(settlementId, new Date().toISOString(), id)
}

export function markFailed(id: string, error: string): void {
  db().prepare("UPDATE submission SET status = 'FAILED', error = ? WHERE id = ?").run(error.slice(0, 500), id)
}

export function countSubmissionsByStatus(): { BOOKED: number; FAILED: number } {
  const rows = db().prepare('SELECT status, COUNT(*) AS n FROM submission GROUP BY status').all() as { status: SubmissionStatus; n: number }[]
  const out = { BOOKED: 0, FAILED: 0 }
  for (const r of rows) if (r.status in out) out[r.status] = r.n
  return out
}
