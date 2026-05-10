-- Create publication_channels table (was missing in earlier migrations)
CREATE TABLE IF NOT EXISTS "publication_channels" (
    "id" SERIAL PRIMARY KEY,
    "publication_id" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "external_id" TEXT,
    "permalink" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'publication_channels_publication_id_fkey'
    ) THEN
        ALTER TABLE "publication_channels" 
            ADD CONSTRAINT "publication_channels_publication_id_fkey" 
            FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Add unique constraint if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'publication_channels_publication_id_channel_key'
    ) THEN
        ALTER TABLE "publication_channels" 
            ADD CONSTRAINT "publication_channels_publication_id_channel_key" 
            UNIQUE ("publication_id", "channel");
    END IF;
END $$;

-- Add index if not exists
CREATE INDEX IF NOT EXISTS "publication_channels_publication_id_idx" 
    ON "publication_channels"("publication_id");

-- Add per-channel content overrides
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "channel_contents" JSONB;

-- Add analytics fields to publication_channels
ALTER TABLE "publication_channels" ADD COLUMN IF NOT EXISTS "views" INTEGER;
ALTER TABLE "publication_channels" ADD COLUMN IF NOT EXISTS "clicks" INTEGER;
ALTER TABLE "publication_channels" ADD COLUMN IF NOT EXISTS "engagement" DOUBLE PRECISION;
