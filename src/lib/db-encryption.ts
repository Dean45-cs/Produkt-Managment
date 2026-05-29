import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

/**
 * Verschlüsselung der SQLite-Datenbank mit SQLCipher (AES-256) über
 * `better-sqlite3-multiple-ciphers` (per npm-Alias als `better-sqlite3` eingebunden).
 *
 * Der Trick: Der offizielle Prisma-Adapter erzeugt im `connect()` die DB-Verbindung
 * und legt sie als öffentliches Feld `client` auf dem zurückgegebenen Adapter ab,
 * BEVOR Prisma die erste SQL-Anweisung ausführt. Wir umhüllen die Factory und setzen
 * `PRAGMA key` als allererste Anweisung – genau das verlangt SQLCipher.
 */

/** Einfache, sichere Übergabe des Passworts an PRAGMA key (Single-Quotes verdoppeln). */
export function escapeKey(pw: string): string {
  return pw.replace(/'/g, "''")
}

type AdapterWithClient = { client: { pragma: (s: string) => unknown } }

/**
 * Liefert eine Prisma-Driver-Adapter-Factory, die eine mit `password` verschlüsselte
 * SQLite-Datei öffnet. Ohne korrektes Passwort schlägt bereits die erste Query fehl
 * ("file is not a database").
 */
export function createEncryptedAdapterFactory(url: string, password: string) {
  const inner = new PrismaBetterSqlite3({ url } as never)
  const key = escapeKey(password)

  const applyKey = (adapter: unknown) => {
    // PRAGMA key MUSS die erste Anweisung auf der Verbindung sein.
    ;(adapter as AdapterWithClient).client.pragma(`key='${key}'`)
    return adapter
  }

  return {
    provider: 'sqlite' as const,
    adapterName: '@prisma/adapter-better-sqlite3',
    async connect() {
      return applyKey(await inner.connect())
    },
    async connectToShadowDb() {
      return applyKey(await inner.connectToShadowDb())
    },
  }
}
