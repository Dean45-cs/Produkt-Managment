-- Mehrere (Teil-)Abrechnungen je Lieferung erlauben:
-- Unique-Index auf Settlement.deliveryId entfernen, normalen Index anlegen.

-- DropIndex
DROP INDEX "Settlement_deliveryId_key";

-- CreateIndex
CREATE INDEX "Settlement_deliveryId_idx" ON "Settlement"("deliveryId");
