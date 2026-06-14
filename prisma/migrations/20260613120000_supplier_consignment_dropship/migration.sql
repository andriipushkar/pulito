-- Supplier consignment / dropship — Phase 0 schema.
-- Purely additive: new enums, new columns (all nullable or defaulted), one new
-- table, three FKs. No data backfill, no destructive change.
--
-- NOTE: hand-authored, NOT from `migrate diff`. The auto-diff also tried to
-- DROP idx_product_name_trgm / idx_product_search_vector and DROP DEFAULT on
-- search_vector — those are the live full-text-search fix applied out-of-band
-- (see memory project_search_vector_fix). They are intentionally NOT included
-- here so this migration can't re-break catalog search.

-- CreateEnum
CREATE TYPE "SupplierMarkupType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "SupplierFulfillment" AS ENUM ('own_stock', 'dropship');

-- CreateEnum
CREATE TYPE "SupplierStockPolicy" AS ENUM ('hide', 'backorder');

-- AlterTable: supplier_channels — per-supplier pricing & fulfilment rules
ALTER TABLE "supplier_channels"
  ADD COLUMN "markup_type" "SupplierMarkupType" NOT NULL DEFAULT 'percent',
  ADD COLUMN "markup_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fulfillment" "SupplierFulfillment" NOT NULL DEFAULT 'own_stock',
  ADD COLUMN "stock_policy" "SupplierStockPolicy" NOT NULL DEFAULT 'hide',
  ADD COLUMN "min_price" DECIMAL(10,2),
  ADD COLUMN "notify_telegram_chat_id" TEXT,
  ADD COLUMN "notify_email" TEXT;

-- AlterTable: products — supplier link + matching key + markup override
ALTER TABLE "products"
  ADD COLUMN "supplier_id" INTEGER,
  ADD COLUMN "supplier_sku" VARCHAR(255),
  ADD COLUMN "markup_override_type" "SupplierMarkupType",
  ADD COLUMN "markup_override_value" DECIMAL(10,2);

-- AlterTable: order_items — supplier reconciliation snapshot
ALTER TABLE "order_items"
  ADD COLUMN "supplier_id" INTEGER,
  ADD COLUMN "supplier_cost_at_sale" DECIMAL(10,2);

-- CreateTable: supplier_sync_logs
CREATE TABLE "supplier_sync_logs" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "items_total" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_unmatched" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_sync_logs_supplier_id_created_at_idx" ON "supplier_sync_logs"("supplier_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_supplier_id_idx" ON "order_items"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_supplier_id_supplier_sku_key" ON "products"("supplier_id", "supplier_sku");

-- AddForeignKey
ALTER TABLE "supplier_sync_logs" ADD CONSTRAINT "supplier_sync_logs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
