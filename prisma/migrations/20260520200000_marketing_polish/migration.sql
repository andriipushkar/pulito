-- Discount stacking: each model declares which others it can combine with.
-- Cart logic checks the intersection of every applied discount's set.
ALTER TABLE "volume_discounts" ADD COLUMN "stackable_with" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "personal_prices"  ADD COLUMN "stackable_with" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "coupons"          ADD COLUMN "stackable_with" TEXT[] NOT NULL DEFAULT '{}';

-- Coupon restrictions: limit to categories, exclude specific products.
ALTER TABLE "coupons" ADD COLUMN "applicable_category_ids" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "coupons" ADD COLUMN "excluded_product_ids"   INTEGER[] NOT NULL DEFAULT '{}';

-- Campaign engagement metrics for ROI tracking.
ALTER TABLE "campaign_logs" ADD COLUMN "opened_at"           TIMESTAMP(3);
ALTER TABLE "campaign_logs" ADD COLUMN "clicked_at"          TIMESTAMP(3);
ALTER TABLE "campaign_logs" ADD COLUMN "converted_at"        TIMESTAMP(3);
ALTER TABLE "campaign_logs" ADD COLUMN "conversion_order_id" INTEGER;

CREATE INDEX "campaign_logs_sent_at_idx" ON "campaign_logs"("sent_at" DESC);
CREATE INDEX "campaign_logs_opened_at_idx" ON "campaign_logs"("opened_at");

-- Banner A/B grouping + impression/click counters.
ALTER TABLE "banners" ADD COLUMN "variant_group"  TEXT;
ALTER TABLE "banners" ADD COLUMN "variant_weight" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "banners" ADD COLUMN "impressions"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "banners" ADD COLUMN "clicks"         INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "banners_variant_group_is_active_idx" ON "banners"("variant_group", "is_active");

-- Loyalty points TTL.
ALTER TABLE "loyalty_levels" ADD COLUMN "points_expiry_months" INTEGER;
