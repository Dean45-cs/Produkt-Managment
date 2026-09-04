-- Neues Geschäftssystem: Geldkonten (Kasse/Bank), Rollen für Kontakte
-- (Verkäufer und/oder Lieferant) und Arten/Sorten über den Produkten.
-- Rein additiv: bestehende Daten bleiben unverändert gültig.

-- ============================ Geld ============================

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CASH',
    "isReserve" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateTable
CREATE TABLE "BookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "bookedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountCt" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT,
    "note" TEXT,
    "transferId" TEXT,
    "settlementId" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BookEntry_accountId_bookedAt_idx" ON "BookEntry"("accountId", "bookedAt");
CREATE INDEX "BookEntry_transferId_idx" ON "BookEntry"("transferId");
CREATE INDEX "BookEntry_settlementId_idx" ON "BookEntry"("settlementId");
CREATE INDEX "BookEntry_purchaseOrderId_idx" ON "BookEntry"("purchaseOrderId");

-- Standardkonten anlegen: die Kasse für das kassierte Bargeld, die Bank als
-- Rücklage, die für die nächste Bestellung nicht angerührt wird.
INSERT INTO "Account" ("id", "name", "kind", "isReserve", "notes", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('acc_kasse', 'Kasse', 'CASH', false, 'Bargeld, das von den Verkäufern reinkommt.', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('acc_bank',  'Bank (Rücklage)', 'BANK', true, 'Wird nicht angerührt – Geld für die nächste Bestellung.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ===================== Rollen für Kontakte =====================

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "isSeller" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Supplier" ADD COLUMN "isWholesaler" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN "expectedSettleDays" INTEGER;

-- Wer bereits an einer Bestellung hängt, ist auch Lieferant.
UPDATE "Supplier"
SET "isWholesaler" = true
WHERE "id" IN (SELECT DISTINCT "supplierId" FROM "PurchaseOrder" WHERE "supplierId" IS NOT NULL);

-- ======================= Arten & Sorten =======================

-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_name_key" ON "ProductGroup"("name");

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "groupId" TEXT REFERENCES "ProductGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD COLUMN "variantName" TEXT;
