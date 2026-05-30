import { PrismaClient } from '../src/generated/prisma/client'
import Database from 'better-sqlite3'
import path from 'path'
import { createEncryptedAdapterFactory, escapeKey } from '../src/lib/db-encryption'
import { runMigrations } from '../src/lib/migrate'

/**
 * Leert ALLE Geschäftsdaten aus der verschlüsselten Datenbank
 * (Produkte, Bestand, Lieferungen, Abrechnungen, Retouren, Bewertungen,
 * Kategorien, Standorte, Lieferanten) – ohne das Schema oder das
 * Master-Passwort zu verändern. Danach ist die App leer, aber einsatzbereit.
 *
 * Aufruf:  DB_MASTER_PASSWORD=deinPasswort npm run db:clear
 */
const password = process.env.DB_MASTER_PASSWORD
if (!password) {
  console.error('Bitte das Master-Passwort setzen, z.B.:  DB_MASTER_PASSWORD=deinPasswort npm run db:clear')
  process.exit(1)
}

const DB_PATH = path.resolve(__dirname, '../dev.db')
const DB_URL = `file:${DB_PATH}`

// Schema sicherstellen + Passwort prüfen
const rawDb = new Database(DB_PATH)
rawDb.pragma(`key='${escapeKey(password)}'`)
try {
  rawDb.prepare('SELECT count(*) FROM sqlite_master').get()
} catch {
  console.error('Falsches Passwort oder DB nicht entschlüsselbar.')
  process.exit(1)
}
runMigrations(rawDb as never, path.resolve(__dirname, '../prisma/migrations'))
rawDb.close()

const prisma = new PrismaClient({ adapter: createEncryptedAdapterFactory(DB_URL, password) as never })

async function main() {
  console.log('Lösche alle Daten...')

  // Reihenfolge beachtet die Fremdschlüssel (erst Kinder, dann Eltern)
  await prisma.review.deleteMany()
  await prisma.returnItem.deleteMany()
  await prisma.return.deleteMany()
  await prisma.settlementItem.deleteMany()
  await prisma.settlement.deleteMany()
  await prisma.deliveryItem.deleteMany()
  await prisma.delivery.deleteMany()
  await prisma.purchaseOrderItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.stockAdjustment.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.product.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.location.deleteMany()
  await prisma.category.deleteMany()

  console.log('Fertig. Alle Geschäftsdaten wurden gelöscht – Schema und Master-Passwort bleiben erhalten.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
