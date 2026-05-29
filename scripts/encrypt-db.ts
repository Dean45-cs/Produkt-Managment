/**
 * Einmalige Verschlüsselung einer bestehenden, noch unverschlüsselten dev.db.
 *
 * Aufruf:  DB_MASTER_PASSWORD=deinPasswort npx tsx scripts/encrypt-db.ts
 *      oder npx tsx scripts/encrypt-db.ts deinPasswort
 *
 * Danach ist die Datei mit AES-256 (SQLCipher) verschlüsselt und nur noch mit
 * diesem Passwort lesbar. Das Passwort wird NICHT gespeichert.
 */
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { escapeKey } from '../src/lib/db-encryption'

const password = process.env.DB_MASTER_PASSWORD || process.argv[2]
if (!password || password.length < 8) {
  console.error('Bitte ein Passwort mit mindestens 8 Zeichen angeben (DB_MASTER_PASSWORD oder als Argument).')
  process.exit(1)
}

const DB_PATH = path.resolve(__dirname, '../dev.db')
if (!fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0) {
  console.error('Keine dev.db gefunden. (Eine neue, verschlüsselte DB entsteht beim ersten Entsperren in der App.)')
  process.exit(1)
}

// Bereits verschlüsselt? (Lesen ohne Key schlägt dann fehl.)
const test = new Database(DB_PATH)
let alreadyEncrypted = false
try {
  test.prepare('SELECT count(*) FROM sqlite_master').get()
} catch {
  alreadyEncrypted = true
}
test.close()

if (alreadyEncrypted) {
  console.log('dev.db scheint bereits verschlüsselt zu sein. Nichts zu tun.')
  process.exit(0)
}

const db = new Database(DB_PATH)
db.pragma(`rekey='${escapeKey(password)}'`)
db.close()
console.log('✓ dev.db wurde mit AES-256 (SQLCipher) verschlüsselt.')
console.log('  Ohne dein Master-Passwort ist die Datei jetzt nicht mehr lesbar.')
