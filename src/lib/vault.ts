import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { createEncryptedAdapterFactory, escapeKey } from './db-encryption'
import { runMigrations } from './migrate'

/**
 * In-Memory-"Tresor": hält die entschlüsselte Prisma-Verbindung samt
 * Session-Token. Existiert nur im Server-Prozess-Speicher – bei einem
 * Neustart ist alles weg, d.h. das Master-Passwort muss erneut eingegeben
 * werden. Das Passwort selbst wird NIE gespeichert.
 */

const DB_PATH = path.resolve(process.cwd(), 'dev.db')
const DB_URL = `file:${DB_PATH}`
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'prisma', 'migrations')

interface Vault {
  prisma: PrismaClient | null
  sessionToken: string | null
  lastActivityMs: number
}

const globalForVault = globalThis as unknown as { __pmsVault?: Vault }
const vault: Vault = globalForVault.__pmsVault ?? { prisma: null, sessionToken: null, lastActivityMs: 0 }
globalForVault.__pmsVault = vault

/**
 * Auto-Sperre: Nach dieser Inaktivität wird der Entschlüsselungs-Key aus dem
 * Speicher entfernt (wichtig am geteilten/Arbeits-PC). Konfigurierbar über
 * IDLE_TIMEOUT_MINUTES, Standard 15 Minuten. 0 = deaktiviert.
 */
const IDLE_MINUTES = (() => {
  const n = parseInt(process.env.IDLE_TIMEOUT_MINUTES || '15', 10)
  return Number.isFinite(n) && n >= 0 ? n : 15
})()
const IDLE_MS = IDLE_MINUTES * 60 * 1000

export function getIdleTimeoutMs(): number {
  return IDLE_MS
}

/** Prüft auf Inaktivitäts-Ablauf und sperrt bei Bedarf (entfernt den Key aus dem RAM). */
function expireIfIdle(): void {
  if (!vault.prisma) return
  if (IDLE_MS > 0 && Date.now() - vault.lastActivityMs > IDLE_MS) {
    const old = vault.prisma
    vault.prisma = null
    vault.sessionToken = null
    // Verbindung im Hintergrund schließen (nicht blockieren).
    old.$disconnect().catch(() => {})
  }
}

export function isUnlocked(): boolean {
  expireIfIdle()
  return vault.prisma !== null
}

export function getPrismaOrNull(): PrismaClient | null {
  expireIfIdle()
  return vault.prisma
}

export function getSessionToken(): string | null {
  expireIfIdle()
  return vault.sessionToken
}

/** Aktualisiert den Aktivitäts-Zeitstempel (Heartbeat bei echter Nutzerinteraktion). */
export function touch(): boolean {
  expireIfIdle()
  if (!vault.prisma) return false
  vault.lastActivityMs = Date.now()
  return true
}

/** Gibt es bereits eine (verschlüsselte) Datenbankdatei? Sonst: Erststart → Passwort festlegen. */
export function dbFileExists(): boolean {
  return fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0
}

export interface UnlockResult {
  ok: boolean
  firstRun: boolean
  error?: 'WRONG_PASSWORD' | 'INIT_FAILED' | 'RATE_LIMITED'
}

// Schutz vor Brute-Force: nach 5 Fehlversuchen 60 Sekunden Sperre.
let failedAttempts = 0
let lockedUntilMs = 0

export async function unlock(password: string): Promise<UnlockResult> {
  const firstRun = !dbFileExists()

  if (Date.now() < lockedUntilMs) {
    return { ok: false, firstRun, error: 'RATE_LIMITED' }
  }

  // 1) Rohe, verschlüsselte Verbindung: Passwort prüfen + Migrationen anwenden.
  //    (Bei falschem Passwort wirft bereits die erste Query → "file is not a database".)
  let raw: InstanceType<typeof Database> | null = null
  try {
    raw = new Database(DB_PATH)
    raw.pragma(`key='${escapeKey(password)}'`)
    raw.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch {
    try { raw?.close() } catch { /* ignore */ }
    failedAttempts++
    if (failedAttempts >= 5) {
      lockedUntilMs = Date.now() + 60_000
      failedAttempts = 0
    }
    return { ok: false, firstRun, error: 'WRONG_PASSWORD' }
  }
  try {
    runMigrations(raw as never, MIGRATIONS_DIR)
  } finally {
    try { raw.close() } catch { /* ignore */ }
  }

  // 2) Prisma-Client mit eigener verschlüsselter Verbindung.
  const prisma = new PrismaClient({
    adapter: createEncryptedAdapterFactory(DB_URL, password) as never,
  })
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch {
    await prisma.$disconnect().catch(() => {})
    return { ok: false, firstRun, error: 'INIT_FAILED' }
  }

  vault.prisma = prisma
  vault.sessionToken = crypto.randomBytes(32).toString('hex')
  vault.lastActivityMs = Date.now()
  failedAttempts = 0
  lockedUntilMs = 0
  return { ok: true, firstRun }
}

export async function lock(): Promise<void> {
  if (vault.prisma) {
    await vault.prisma.$disconnect().catch(() => {})
  }
  vault.prisma = null
  vault.sessionToken = null
}
