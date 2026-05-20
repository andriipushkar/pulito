-- AlterTable
ALTER TABLE "products" ADD COLUMN "barcode" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
