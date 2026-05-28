import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const adapter = new PrismaBetterSqlite3({ url: `file:${path.resolve(__dirname, '../dev.db')}` } as never)
const prisma = new PrismaClient({ adapter } as never)

async function main() {
  console.log('Seeding database...')

  // Clear existing data
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

  // Suppliers
  const sup1 = await prisma.supplier.create({ data: { name: 'TechDistribution GmbH', contactName: 'Max Müller', email: 'max@techdist.de', phone: '030 1234567' } })

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
  }

  console.log('Seed complete! Kategorien, Standorte, Lieferanten, Produkte, Bestand und Demo-Abrechnungen angelegt.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
