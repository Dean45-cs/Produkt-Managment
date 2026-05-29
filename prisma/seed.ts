import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const adapter = new PrismaBetterSqlite3({ url: `file:${path.resolve(__dirname, '../dev.db')}` } as never)
const prisma = new PrismaClient({ adapter } as never)

async function main() {
  console.log('Seeding database...')

  // Clear existing data
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

  // Categories
  const cat1 = await prisma.category.create({ data: { name: 'Elektronik', description: 'Elektronische Geräte', color: '#3b82f6' } })
  const cat2 = await prisma.category.create({ data: { name: 'Zubehör', description: 'Diverses Zubehör', color: '#8b5cf6' } })

  // Locations
  const loc1 = await prisma.location.create({ data: { name: 'Hauptlager Berlin', type: 'WAREHOUSE', address: 'Musterstraße 1, 10115 Berlin' } })
  const loc2 = await prisma.location.create({ data: { name: 'Außenlager Hamburg', type: 'WAREHOUSE', address: 'Hafenweg 5, 20457 Hamburg' } })

  // Suppliers (zwei Distributoren für den Vergleich)
  const sup1 = await prisma.supplier.create({ data: { name: 'TechDistribution GmbH', contactName: 'Max Müller', email: 'max@techdist.de', phone: '030 1234567' } })
  const sup2 = await prisma.supplier.create({ data: { name: 'ElektroHandel Nord', contactName: 'Sabine Klein', email: 'klein@elektronord.de', phone: '040 7654321' } })

  // Products
  const prod1 = await prisma.product.create({ data: { name: 'HDMI Kabel 2m', sku: 'HDMI-001', categoryId: cat2.id, unit: 'Stück', purchasePriceCt: 599, minStockLevel: 20, reorderPoint: 50, reorderQty: 100 } })
  const prod2 = await prisma.product.create({ data: { name: 'USB Hub 4-Port', sku: 'USB-HUB-4P', categoryId: cat1.id, unit: 'Stück', purchasePriceCt: 1299, minStockLevel: 10, reorderPoint: 25, reorderQty: 50 } })
  const prod3 = await prisma.product.create({ data: { name: 'Wireless Maus', sku: 'MOUSE-WL-01', categoryId: cat1.id, unit: 'Stück', purchasePriceCt: 2499, minStockLevel: 5, reorderPoint: 15, reorderQty: 30 } })

  // Initial inventory
  await prisma.inventory.createMany({ data: [
    { productId: prod1.id, locationId: loc1.id, quantity: 150 },
    { productId: prod2.id, locationId: loc1.id, quantity: 45 },
    { productId: prod3.id, locationId: loc1.id, quantity: 8 },
    { productId: prod1.id, locationId: loc2.id, quantity: 80 },
    { productId: prod2.id, locationId: loc2.id, quantity: 20 },
  ] })

  // Historical settlements for charts and forecast
  const months = [
    { settledAt: new Date('2026-02-15'), qty1: 30, a1: 279000, qty2: 10, a2: 189000, qty3: 5, a3: 175000 },
    { settledAt: new Date('2026-03-14'), qty1: 45, a1: 418500, qty2: 15, a2: 283500, qty3: 8, a3: 280000 },
    { settledAt: new Date('2026-04-16'), qty1: 60, a1: 558000, qty2: 20, a2: 378000, qty3: 12, a3: 420000 },
    { settledAt: new Date('2026-05-10'), qty1: 75, a1: 697500, qty2: 25, a2: 472500, qty3: 15, a3: 525000 },
  ]

  for (const m of months) {
    const delivery = await prisma.delivery.create({
      data: {
        supplierId: sup1.id,
        status: 'SETTLED',
        deliveryDate: new Date(m.settledAt.getTime() - 14 * 24 * 60 * 60 * 1000),
        items: { create: [
          { productId: prod1.id, locationId: loc1.id, quantitySent: m.qty1 },
          { productId: prod2.id, locationId: loc1.id, quantitySent: m.qty2 },
          { productId: prod3.id, locationId: loc1.id, quantitySent: m.qty3 },
        ] },
      },
    })
    await prisma.settlement.create({
      data: {
        deliveryId: delivery.id,
        settledAt: m.settledAt,
        totalAmountCt: m.a1 + m.a2 + m.a3,
        items: { create: [
          { productId: prod1.id, quantitySold: m.qty1, totalAmountCt: m.a1 },
          { productId: prod2.id, quantitySold: m.qty2, totalAmountCt: m.a2 },
          { productId: prod3.id, quantitySold: m.qty3, totalAmountCt: m.a3 },
        ] },
      },
    })

    // Zweiter Distributor: kleinere Mengen und ~10% niedrigere Ø-Preise
    const d2qty1 = Math.round(m.qty1 * 0.5)
    const d2qty2 = Math.round(m.qty2 * 0.5)
    const d2a1 = Math.round(m.a1 * 0.5 * 0.9)
    const d2a2 = Math.round(m.a2 * 0.5 * 0.9)
    const delivery2 = await prisma.delivery.create({
      data: {
        supplierId: sup2.id,
        status: 'SETTLED',
        deliveryDate: new Date(m.settledAt.getTime() - 14 * 24 * 60 * 60 * 1000),
        items: { create: [
          { productId: prod1.id, locationId: loc1.id, quantitySent: d2qty1 },
          { productId: prod2.id, locationId: loc1.id, quantitySent: d2qty2 },
        ] },
      },
    })
    await prisma.settlement.create({
      data: {
        deliveryId: delivery2.id,
        settledAt: m.settledAt,
        totalAmountCt: d2a1 + d2a2,
        items: { create: [
          { productId: prod1.id, quantitySold: d2qty1, totalAmountCt: d2a1 },
          { productId: prod2.id, quantitySold: d2qty2, totalAmountCt: d2a2 },
        ] },
      },
    })
  }

  // Demo: aktuell offene Lieferung, die nur teilweise abgerechnet wurde
  // (Distributor hat von 10 HDMI-Kabeln erst 5 verkauft, USB-Hubs noch gar nicht)
  const openDelivery = await prisma.delivery.create({
    data: {
      supplierId: sup1.id,
      status: 'PARTIALLY_SETTLED',
      deliveryDate: new Date('2026-05-20'),
      notes: 'Distributor hat bisher nur einen Teil verkauft.',
      items: { create: [
        { productId: prod1.id, locationId: loc1.id, quantitySent: 10 },
        { productId: prod2.id, locationId: loc1.id, quantitySent: 8 },
      ] },
    },
  })
  await prisma.settlement.create({
    data: {
      deliveryId: openDelivery.id,
      settledAt: new Date('2026-05-26'),
      totalAmountCt: 5 * 9500,
      notes: '1. Teilabrechnung — 5 von 10 HDMI-Kabeln verkauft',
      items: { create: [
        { productId: prod1.id, quantitySold: 5, totalAmountCt: 5 * 9500 },
      ] },
    },
  })

  // Kundenbewertungen (Sterne) — zeigen, wie zufrieden die Kunden waren
  await prisma.review.createMany({ data: [
    { productId: prod1.id, rating: 5, customerName: 'Anna M.', comment: 'Top Kabel, funktioniert einwandfrei.', createdAt: new Date('2026-03-02') },
    { productId: prod1.id, rating: 4, customerName: 'Jens K.', comment: 'Gut, aber etwas kurz.', createdAt: new Date('2026-04-11') },
    { productId: prod1.id, rating: 5, customerName: 'Petra L.', createdAt: new Date('2026-05-05') },
    { productId: prod2.id, rating: 4, customerName: 'Tom B.', comment: 'Solider USB-Hub fürs Büro.', createdAt: new Date('2026-03-20') },
    { productId: prod2.id, rating: 3, customerName: 'Lisa R.', comment: 'Ein Port wackelt etwas.', createdAt: new Date('2026-04-25') },
    { productId: prod3.id, rating: 5, customerName: 'Mehmet Y.', comment: 'Beste Maus in dieser Preisklasse!', createdAt: new Date('2026-05-12') },
    { productId: prod3.id, rating: 5, customerName: 'Clara D.', createdAt: new Date('2026-05-18') },
    { productId: prod3.id, rating: 4, customerName: 'Stefan W.', comment: 'Sehr gut, Akku hält lange.', createdAt: new Date('2026-05-20') },
  ] })

  console.log('Seed complete! Kategorien, Standorte, Lieferanten, Produkte, Bestand und Demo-Abrechnungen angelegt.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
