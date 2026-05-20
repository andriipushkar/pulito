-- OrderStatus: add intermediate "packed" stage so the audit trail can show
-- who packed an order between "paid" and "shipped".
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'packed';

-- Product physical dimensions + cost (margin analytics, Nova Poshta TTN size).
ALTER TABLE "products" ADD COLUMN "weight_grams" INTEGER;
ALTER TABLE "products" ADD COLUMN "length_mm" INTEGER;
ALTER TABLE "products" ADD COLUMN "width_mm" INTEGER;
ALTER TABLE "products" ADD COLUMN "height_mm" INTEGER;
ALTER TABLE "products" ADD COLUMN "cost" DECIMAL(10, 2);

-- Subscription cancellation reasons + payment-retry state + pre-delivery reminder.
CREATE TYPE "SubscriptionCancelReason" AS ENUM (
  'user_requested',
  'payment_failed',
  'product_unavailable',
  'other'
);

ALTER TABLE "subscriptions" ADD COLUMN "paused_reason" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "cancel_reason" "SubscriptionCancelReason";
ALTER TABLE "subscriptions" ADD COLUMN "payment_retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "last_failed_payment_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "remind_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);

CREATE INDEX "subscriptions_status_remind_at_idx" ON "subscriptions"("status", "remind_at");

-- Pallets — group multiple B2B orders into one shipment.
CREATE TYPE "PalletStatus" AS ENUM ('forming', 'in_transit', 'delivered', 'cancelled');

CREATE TABLE "pallets" (
  "id"              SERIAL PRIMARY KEY,
  "name"            VARCHAR(255) NOT NULL,
  "status"          "PalletStatus" NOT NULL DEFAULT 'forming',
  "region"          TEXT,
  "carrier"         TEXT,
  "tracking_number" TEXT,
  "weight_kg"       DECIMAL(8, 2),
  "delivery_cost"   DECIMAL(10, 2),
  "notes"           TEXT,
  "created_by"      INTEGER,
  "shipped_at"      TIMESTAMP(3),
  "delivered_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "pallets_status_idx" ON "pallets"("status");
CREATE INDEX "pallets_created_at_idx" ON "pallets"("created_at" DESC);

CREATE TABLE "pallet_orders" (
  "id"         SERIAL PRIMARY KEY,
  "pallet_id"  INTEGER NOT NULL REFERENCES "pallets"("id") ON DELETE CASCADE,
  "order_id"   INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pallet_orders_pallet_order_uniq" UNIQUE ("pallet_id", "order_id")
);

CREATE INDEX "pallet_orders_order_id_idx" ON "pallet_orders"("order_id");
