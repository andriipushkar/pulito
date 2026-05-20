-- Foundation for product variants. Adds a `product_variants` table — every variant
-- belongs to one product and carries its own SKU, optional price overrides,
-- stock and option labels (size, color, flavour, etc.).
--
-- Public-site rendering and cart integration are intentionally NOT included
-- here; the admin can manage variants now, but the storefront keeps using the
-- parent product's stock/price until that frontend work lands separately.

CREATE TABLE "product_variants" (
  "id"               SERIAL PRIMARY KEY,
  "product_id"       INTEGER NOT NULL,
  "sku"              VARCHAR(255) NOT NULL,
  "name"             VARCHAR(255) NOT NULL,
  "price_retail"     DECIMAL(10, 2),
  "price_wholesale"  DECIMAL(10, 2),
  "quantity"         INTEGER NOT NULL DEFAULT 0,
  "options"          JSONB,
  "image_path"       TEXT,
  "is_active"        BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order"       INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
