CREATE TYPE "WarehouseTransferStatus" AS ENUM ('draft', 'in_transit', 'completed', 'cancelled');

CREATE TABLE "warehouse_transfers" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "from_warehouse_id" INTEGER NOT NULL,
    "to_warehouse_id" INTEGER NOT NULL,
    "status" "WarehouseTransferStatus" NOT NULL DEFAULT 'draft',
    "created_by" INTEGER NOT NULL,
    "shipped_at" TIMESTAMP(3),
    "shipped_by" INTEGER,
    "received_at" TIMESTAMP(3),
    "received_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_transfers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_transfers_reference_key" ON "warehouse_transfers"("reference");
CREATE INDEX "warehouse_transfers_status_idx" ON "warehouse_transfers"("status");
CREATE INDEX "warehouse_transfers_created_at_idx" ON "warehouse_transfers"("created_at");

CREATE TABLE "warehouse_transfer_items" (
    "id" SERIAL NOT NULL,
    "transfer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "warehouse_transfer_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_transfer_items_transfer_id_product_id_key" ON "warehouse_transfer_items"("transfer_id", "product_id");

ALTER TABLE "warehouse_transfers"
    ADD CONSTRAINT "warehouse_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "warehouse_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "warehouse_transfer_items"
    ADD CONSTRAINT "warehouse_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "warehouse_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "warehouse_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
