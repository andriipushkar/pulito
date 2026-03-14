-- Add per-channel content overrides
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "channel_contents" JSONB;

-- Add analytics fields to publication_channels
ALTER TABLE "publication_channels" ADD COLUMN IF NOT EXISTS "views" INTEGER;
ALTER TABLE "publication_channels" ADD COLUMN IF NOT EXISTS "clicks" INTEGER;
ALTER TABLE "publication_channels" ADD COLUMN IF NOT EXISTS "engagement" DOUBLE PRECISION;
