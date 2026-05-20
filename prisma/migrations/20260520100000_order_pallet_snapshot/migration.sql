-- Capture per-order pallet quote details at checkout time. Schema-only —
-- existing orders get NULL which the UI renders as "—".
ALTER TABLE "orders" ADD COLUMN "pallet_weight_kg" DECIMAL(8, 2);
ALTER TABLE "orders" ADD COLUMN "pallet_region" TEXT;
