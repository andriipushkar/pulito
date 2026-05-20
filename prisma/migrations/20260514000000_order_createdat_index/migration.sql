-- Order list defaults to ORDER BY created_at DESC; without this index
-- Postgres falls back to seq-scan + sort whenever no status filter is
-- applied. Cheap to add now (table is empty); take-write-lock cost only
-- matters once row counts grow, and at that point an in-place re-index
-- is the appropriate remedy.
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx"
  ON "orders" ("created_at" DESC);
