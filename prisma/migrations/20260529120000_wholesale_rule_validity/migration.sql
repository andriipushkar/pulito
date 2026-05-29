-- WR7: optional scheduling window for wholesale rules. Both columns are
-- nullable (NULL = open-ended on that side) with no default, so this is a
-- metadata-only add — instant even on a large table, no rewrite/lock contention.
-- IF NOT EXISTS keeps it idempotent (safe if the column was added by hand first).
ALTER TABLE "wholesale_rules" ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMP(3);
ALTER TABLE "wholesale_rules" ADD COLUMN IF NOT EXISTS "valid_until" TIMESTAMP(3);
