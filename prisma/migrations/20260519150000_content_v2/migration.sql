-- BlogPost soft-delete
ALTER TABLE "blog_posts" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "blog_posts_deleted_at_idx" ON "blog_posts"("deleted_at");

-- BlogComment moderation
CREATE TYPE "BlogCommentStatus" AS ENUM ('pending', 'approved', 'rejected', 'spam');

CREATE TABLE "blog_comments" (
  "id"              SERIAL PRIMARY KEY,
  "post_id"         INTEGER NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
  "author_name"     TEXT NOT NULL,
  "author_email"    TEXT,
  "author_user_id"  INTEGER,
  "content"         VARCHAR(2000) NOT NULL,
  "status"          "BlogCommentStatus" NOT NULL DEFAULT 'pending',
  "ip_address"      TEXT,
  "parent_id"       INTEGER REFERENCES "blog_comments"("id"),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at"     TIMESTAMP(3),
  "approved_by"     INTEGER
);

CREATE INDEX "blog_comments_post_status_idx" ON "blog_comments"("post_id", "status");
CREATE INDEX "blog_comments_status_created_idx" ON "blog_comments"("status", "created_at" DESC);

-- StaticPage hierarchy
ALTER TABLE "static_pages" ADD COLUMN "parent_id" INTEGER REFERENCES "static_pages"("id");
CREATE INDEX "static_pages_parent_id_idx" ON "static_pages"("parent_id");

-- FaqCategory + categoryRefId on FaqItem (legacy `category` string kept for backfill)
CREATE TABLE "faq_categories" (
  "id"           SERIAL PRIMARY KEY,
  "name"         TEXT NOT NULL UNIQUE,
  "slug"         TEXT NOT NULL UNIQUE,
  "description"  TEXT,
  "icon_path"    TEXT,
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "faq_items" ADD COLUMN "category_ref_id" INTEGER REFERENCES "faq_categories"("id");
CREATE INDEX "faq_items_category_ref_id_sort_order_idx" ON "faq_items"("category_ref_id", "sort_order");

-- Backfill: create one FaqCategory per distinct legacy string and link items.
-- slug is a simple lowercase/no-spaces transform; conflicts are vanishingly rare
-- on a freshly-introduced dictionary table.
INSERT INTO "faq_categories" ("name", "slug")
SELECT DISTINCT
  "category",
  LOWER(REGEXP_REPLACE(TRIM("category"), '[^a-zA-Z0-9]+', '-', 'g'))
FROM "faq_items"
WHERE "category" IS NOT NULL AND TRIM("category") <> ''
ON CONFLICT DO NOTHING;

UPDATE "faq_items" i
SET "category_ref_id" = c."id"
FROM "faq_categories" c
WHERE c."name" = i."category";

-- ProductVariant physical params + cost
ALTER TABLE "product_variants" ADD COLUMN "weight_grams" INTEGER;
ALTER TABLE "product_variants" ADD COLUMN "length_mm" INTEGER;
ALTER TABLE "product_variants" ADD COLUMN "width_mm" INTEGER;
ALTER TABLE "product_variants" ADD COLUMN "height_mm" INTEGER;
ALTER TABLE "product_variants" ADD COLUMN "cost" DECIMAL(10, 2);
