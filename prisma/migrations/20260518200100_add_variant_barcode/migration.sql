-- AlterTable: variants can have their own EAN (different size/colour = different GTIN)
ALTER TABLE "product_variants" ADD COLUMN "barcode" VARCHAR(20);

-- CreateIndex: unique across the variants table (separate space from products.barcode,
-- but in practice GS1 issues each GTIN once so collisions are unlikely)
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");
