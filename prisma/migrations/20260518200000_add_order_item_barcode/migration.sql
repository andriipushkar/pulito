-- AlterTable: snapshot of product barcode at the time of order
ALTER TABLE "order_items" ADD COLUMN "product_barcode" VARCHAR(20);

-- Backfill from currently linked product (best-effort; orders with deleted
-- products will keep NULL, which is correct: we don't know what was scanned).
UPDATE "order_items" oi
SET "product_barcode" = p."barcode"
FROM "products" p
WHERE oi."product_id" = p."id"
  AND p."barcode" IS NOT NULL
  AND oi."product_barcode" IS NULL;
