-- Add Facebook publishing fields to publications
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "fb_post_id" TEXT;
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "fb_permalink" TEXT;
