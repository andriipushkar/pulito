-- Brand (manufacturer) catalog. Each product can optionally point at a brand;
-- brand goes to NULL on delete so soft-removing a brand doesn't orphan products.

CREATE TABLE "brands" (
  "id"          SERIAL PRIMARY KEY,
  "name"        VARCHAR(255) NOT NULL,
  "slug"        VARCHAR(255) NOT NULL,
  "description" TEXT,
  "logo_path"   TEXT,
  "is_visible"  BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"  TIMESTAMP(3)
);

CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

ALTER TABLE "products" ADD COLUMN "brand_id" INTEGER;
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
