-- Supplier consignment polish: currency rate, reserve-aware sync, zero-missing,
-- and an idempotency marker for dropship notifications.
-- Additive only. Hand-authored (not migrate diff) to avoid the search_vector
-- drift trap (see memory project_search_vector_fix).

-- AlterTable: supplier_channels
ALTER TABLE "supplier_channels"
  ADD COLUMN "feed_currency_rate" DECIMAL(12,4) NOT NULL DEFAULT 1,
  ADD COLUMN "reserve_aware" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "zero_missing" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: orders
ALTER TABLE "orders" ADD COLUMN "dropship_notified_at" TIMESTAMP(3);
