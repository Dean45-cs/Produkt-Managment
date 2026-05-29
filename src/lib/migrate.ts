import fs from 'fs'
import path from 'path'

/**
 * Mini-Migrations-Runner für die VERSCHLÜSSELTE Datenbank.
 *
 * Prisma Migrate kann eine SQLCipher-verschlüsselte Datei nicht öffnen (die
 * Migrations-Engine kennt den Schlüssel nicht). Daher wenden wir die bereits
 * vorhandenen `prisma/migrations/<ts>/migration.sql`-Dateien selbst über die
 * entschlüsselte Verbindung an und merken uns angewandte Migrationen in
 * `_app_migrations`.
 */

interface RawStatement {
  all: (...args: unknown[]) => unknown[]
  run: (...args: unknown[]) => unknown
  get: (...args: unknown[]) => unknown
}
interface RawDb {
  exec: (sql: string) => unknown
  prepare: (sql: string) => RawStatement
  transaction: (fn: () => void) => () => void
}

export function runMigrations(db: RawDb, migrationsDir: string): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS "_app_migrations" ("name" TEXT PRIMARY KEY, "applied_at" TEXT NOT NULL)')

  const applied = new Set(
    (db.prepare('SELECT name FROM "_app_migrations"').all() as { name: string }[]).map((r) => r.name)
  )

  // Bereits zuvor mit Prisma migrierte (jetzt verschlüsselte) DB übernehmen:
  // vorhandene _prisma_migrations als "schon angewandt" markieren.
  if (applied.size === 0) {
    const hasPrisma = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'")
      .get()
    if (hasPrisma) {
      const rows = db
        .prepare('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
        .all() as { migration_name: string }[]
      const ins = db.prepare('INSERT OR IGNORE INTO "_app_migrations" (name, applied_at) VALUES (?, ?)')
      for (const r of rows) {
        ins.run(r.migration_name, new Date().toISOString())
        applied.add(r.migration_name)
      }
    }
  }

  if (!fs.existsSync(migrationsDir)) return []

  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  const newly: string[] = []
  for (const name of dirs) {
    if (applied.has(name)) continue
    const sqlPath = path.join(migrationsDir, name, 'migration.sql')
    if (!fs.existsSync(sqlPath)) continue
    const sql = fs.readFileSync(sqlPath, 'utf8')
    const tx = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO "_app_migrations" (name, applied_at) VALUES (?, ?)').run(
        name,
        new Date().toISOString()
      )
    })
    tx()
    newly.push(name)
  }
  return newly
}
