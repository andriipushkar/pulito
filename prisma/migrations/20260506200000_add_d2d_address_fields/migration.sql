-- Structured address fields for Nova Poshta D2D (door-to-door) delivery.
-- These complement deliveryAddress (kept as human-readable label) so we can
-- pass proper street UUID + building + flat when creating the TTN.
ALTER TABLE "orders"
  ADD COLUMN "delivery_street_ref" TEXT,
  ADD COLUMN "delivery_building" TEXT,
  ADD COLUMN "delivery_flat" TEXT;
