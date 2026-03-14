-- Fix reviews.status column type: convert from TEXT to ReviewStatus enum
-- The ReviewStatus enum was created but the column was left as TEXT

-- Drop the default first (cannot auto-cast default)
ALTER TABLE "reviews" ALTER COLUMN "status" DROP DEFAULT;

-- Convert from TEXT to ReviewStatus enum
ALTER TABLE "reviews"
  ALTER COLUMN "status" SET DATA TYPE "ReviewStatus"
  USING "status"::"ReviewStatus";

-- Restore the default
ALTER TABLE "reviews" ALTER COLUMN "status" SET DEFAULT 'pending'::"ReviewStatus";
