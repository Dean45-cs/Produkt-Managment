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
}

const globalForVault = globalThis as unknown as { __pmsVault?: Vault }
const vault: Vault = globalForVault.__pmsVault ?? { prisma: null, sessionToken: null }
globalForVault.__pmsVault = vault

export function isUnlocked(): boolean {
  return vault.prisma !== null
}

export function getPrismaOrNull(): PrismaClient | null {
  return vault.prisma
}

export function getSessionToken(): string | null {
  return vault.sessionToken
}

/** Gibt es bereits eine (verschlüsselte) Datenbankdatei? Sonst: Erststart → Passwort festlegen. */
export function dbFileExists(): boolean {
  return fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0
}

export interface UnlockResult {
  ok: boolean
  firstRun: boolean
  error?: 'WRONG_PASSWORD' | 'INIT_FAILED'
}

export async function unlock(password: string): Promise<UnlockResult> {
  const firstRun = !dbFileExists()

  // 1) Rohe, verschlüsselte Verbindung: Passwort prüfen + Migrationen anwenden.
  //    (Bei falschem Passwort wirft bereits die erste Query → "file is not a database".)
  let raw: InstanceType<typeof Database> | null = null
  try {
    raw = new Database(DB_PATH)
    raw.pragma(`key='${escapeKey(password)}'`)
    raw.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch {
    try { raw?.close() } catch { /* ignore */ }
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
  return { ok: true, firstRun }
}

export async function lock(): Promise<void> {
  if (vault.prisma) {
    await vault.prisma.$disconnect().catch(() => {})
  }
  vault.prisma = null
  vault.sessionToken = null
}
