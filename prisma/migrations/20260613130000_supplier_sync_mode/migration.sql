-- Supplier consignment — Phase 2: discriminate which engine runs per channel.
-- Additive only. Existing channels default to the legacy catalog importer.
-- Hand-authored (not migrate diff) to avoid the search_vector drift trap
-- (see memory project_search_vector_fix).

-- CreateEnum
CREATE TYPE "SupplierSyncMode" AS ENUM ('catalog_import', 'price_stock');

-- AlterTable
ALTER TABLE "supplier_channels"
  ADD COLUMN "sync_mode" "SupplierSyncMode" NOT NULL DEFAULT 'catalog_import';
