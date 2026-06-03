import { Pool, type PoolClient } from 'pg'

/**
 * Postgres-Verbindung (Neon/Vercel Postgres). Pool + Schema werden auf
 * globalThis gecacht, damit es auch in der serverlosen Umgebung nicht bei jedem
 * Aufruf neu verbindet. Schema wird per CREATE TABLE IF NOT EXISTS sichergestellt.
 */

const g = globalThis as unknown as { __portalPool?: Pool; __portalSchema?: Promise<void> }

/**
 * Verbindungs-String. Unterstützt sowohl die eigene Variable DATABASE_URL als
 * auch die von Vercel Postgres / Neon automatisch gesetzten Namen. Die
 * "non-pooling"-Variante wird bevorzugt (zuverlässig für Schema-Anlage/Transaktionen).
 */
function connectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  )
}

export function pool(): Pool {
  if (!g.__portalPool) {
    const cs = connectionString()
    if (!cs) {
      throw new Error('Keine Datenbank-URL gesetzt (DATABASE_URL oder POSTGRES_URL). Ist eine Postgres-DB mit dem Vercel-Projekt verbunden?')
    }
    // SSL für gehostete DBs (Vercel/Neon), aber nicht für lokales Postgres.
    const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(cs)
    g.__portalPool = new Pool({
      connectionString: cs,
      max: 5,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    })
  }
  return g.__portalPool
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS seller (
  supplier_ref TEXT PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  pin_hash     TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  name         TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS open_item (
  supplier_ref       TEXT NOT NULL,
  delivery_id        TEXT NOT NULL,
  product_id         TEXT NOT NULL,
  delivery_label     TEXT,
  delivery_date      TEXT,
  product_name       TEXT,
  quantity_open      INTEGER NOT NULL,
  suggested_price_ct INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (supplier_ref, delivery_id, product_id)
);
CREATE INDEX IF NOT EXISTS open_item_supplier ON open_item(supplier_ref);
CREATE TABLE IF NOT EXISTS submission (
  id             TEXT PRIMARY KEY,
  supplier_ref   TEXT NOT NULL,
  token          TEXT NOT NULL,
  delivery_id    TEXT NOT NULL,
  delivery_label TEXT,
  payload_json   JSONB NOT NULL,
  reported_at    TEXT,
  note           TEXT,
  portal_status  TEXT NOT NULL DEFAULT 'NEW',
  book_status    TEXT,
  settlement_ref TEXT,
  book_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  acked_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS submission_portal_status ON submission(portal_status);
CREATE INDEX IF NOT EXISTS submission_supplier ON submission(supplier_ref);
CREATE TABLE IF NOT EXISTS access_log (
  id           BIGSERIAL PRIMARY KEY,
  supplier_ref TEXT,
  token        TEXT,
  event        TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_log_supplier ON access_log(supplier_ref, created_at DESC);
`

export function ensureSchema(): Promise<void> {
  if (!g.__portalSchema) {
    g.__portalSchema = pool().query(SCHEMA).then(() => undefined)
  }
  return g.__portalSchema
}

export async function q<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  await ensureSchema()
  const res = await pool().query(text, params)
  return res.rows as T[]
}

export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema()
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
