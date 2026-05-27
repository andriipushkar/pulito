-- Convert VolumeDiscount.discount_percent from FLOAT → DECIMAL(5,2). Same
-- precision-loss reason as billing money fields: 12.5% silently becomes
-- 12.4999… in IEEE 754 over enough cart-total recalculations.
-- Existing FLOAT values cast cleanly to DECIMAL(5,2) up to the column limit.

ALTER TABLE "volume_discounts"
  ALTER COLUMN "discount_percent" TYPE DECIMAL(5, 2) USING "discount_percent"::DECIMAL(5, 2),
  ALTER COLUMN "discount_percent" SET DEFAULT 0;
