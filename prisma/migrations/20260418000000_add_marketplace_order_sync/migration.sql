-- Add NotificationType values used by email-sequences service.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'welcome';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'winback';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'review_request';

-- Add OrderSource values for marketplace order imports.
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'rozetka';
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'prom';

-- Add external_id on orders to dedupe marketplace imports by (source, external_id).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "external_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_source_external_id_key"
  ON "orders"("source", "external_id");
