CREATE TYPE "StockCountStatus" AS ENUM ('in_progress', 'completed', 'cancelled');

CREATE TABLE "stock_counts" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'in_progress',
    "started_by" INTEGER NOT NULL,
    "completed_by" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_counts_reference_key" ON "stock_counts"("reference");
CREATE INDEX "stock_counts_status_idx" ON "stock_counts"("status");
CREATE INDEX "stock_counts_started_at_idx" ON "stock_counts"("started_at");

CREATE TABLE "stock_count_items" (
    "id" SERIAL NOT NULL,
    "count_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "counted_qty" INTEGER,
    "variance" INTEGER,
    "counted_at" TIMESTAMP(3),

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_count_items_count_id_product_id_key" ON "stock_count_items"("count_id", "product_id");

ALTER TABLE "stock_counts"
    ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "stock_count_items"
    ADD CONSTRAINT "stock_count_items_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "stock_count_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
