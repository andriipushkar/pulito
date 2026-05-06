-- Store latest carrier tracking status (e.g. "Прибуло у відділення") so customers
-- see fresh info without polling the carrier API on every page load.
ALTER TABLE "orders"
  ADD COLUMN "tracking_status" TEXT,
  ADD COLUMN "tracking_status_at" TIMESTAMP(3);
