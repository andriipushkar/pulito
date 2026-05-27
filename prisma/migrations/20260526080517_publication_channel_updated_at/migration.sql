-- Add `updated_at` to publication_channels so acquireChannelLock can detect
-- stuck `pending` rows (process crashed mid-publish) and auto-recover the
-- lock instead of leaving the row blocked forever.
--
-- Safe to apply online: ADD COLUMN with DEFAULT now() runs as a metadata
-- change in Postgres 11+ and backfills existing rows with the migration
-- timestamp. Subsequent Prisma writes hit @updatedAt automatically.

ALTER TABLE "publication_channels"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
