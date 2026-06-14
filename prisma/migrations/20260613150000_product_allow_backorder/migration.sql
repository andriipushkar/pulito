-- Backorder support: products linked to a backorder-policy supplier stay
-- sellable at quantity 0. Additive, default false. Hand-authored (not migrate
-- diff) to avoid the search_vector drift trap (see project_search_vector_fix).

-- AlterTable
ALTER TABLE "products" ADD COLUMN "allow_backorder" BOOLEAN NOT NULL DEFAULT false;
