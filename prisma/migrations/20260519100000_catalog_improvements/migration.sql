-- ProductBadge: unique per (product, badge_type) + isLocked flag
-- Reasons:
--  • prevents cron from inserting a "new_arrival" badge that an admin already added manually
--  • isLocked = admin's manual badge that the cron must not delete

ALTER TABLE "product_badges" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "product_badges_product_id_badge_type_key"
  ON "product_badges"("product_id", "badge_type");

-- Brand: SEO + website + country
ALTER TABLE "brands" ADD COLUMN "website" TEXT;
ALTER TABLE "brands" ADD COLUMN "country" TEXT;
ALTER TABLE "brands" ADD COLUMN "seo_title" TEXT;
ALTER TABLE "brands" ADD COLUMN "seo_description" TEXT;
