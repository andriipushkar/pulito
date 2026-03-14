-- Create reviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS "reviews" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "comment" VARCHAR(2000),
    "pros" VARCHAR(500),
    "cons" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB,
    "admin_reply" VARCHAR(1000),
    "admin_reply_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint and indexes for reviews
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_id_user_id_key') THEN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_user_id_key" UNIQUE ("product_id", "user_id");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "reviews_product_id_status_idx" ON "reviews"("product_id", "status");
CREATE INDEX IF NOT EXISTS "reviews_user_id_idx" ON "reviews"("user_id");
CREATE INDEX IF NOT EXISTS "reviews_created_at_idx" ON "reviews"("created_at");

-- Add foreign keys for reviews
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_id_fkey') THEN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_id_fkey') THEN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Create ReviewStatus enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS "webhook_logs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "status_code" INTEGER,
    "error" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_logs_source_processed_at_idx" ON "webhook_logs"("source", "processed_at" DESC);
