-- Inventory integrity at DB level. The service layer already validates these
-- but a bug in transfer/order/cron logic could write a negative quantity or
-- over-reserve. The CHECK constraints turn those into Postgres errors instead
-- of silent drift that takes days to spot on the dashboard.
--
-- IF NOT EXISTS guards keep the migration idempotent — running against a DB
-- that already has these constraints (manual fix attempts) won't fail.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_stock_quantity_non_negative'
  ) THEN
    ALTER TABLE "warehouse_stock"
      ADD CONSTRAINT "warehouse_stock_quantity_non_negative" CHECK ("quantity" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_stock_reserved_non_negative'
  ) THEN
    ALTER TABLE "warehouse_stock"
      ADD CONSTRAINT "warehouse_stock_reserved_non_negative" CHECK ("reserved" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_stock_reserved_lte_quantity'
  ) THEN
    ALTER TABLE "warehouse_stock"
      ADD CONSTRAINT "warehouse_stock_reserved_lte_quantity" CHECK ("reserved" <= "quantity");
  END IF;
END $$;
