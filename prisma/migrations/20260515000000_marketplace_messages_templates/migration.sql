-- Persist marketplace messages in DB instead of refetching from API every time.
-- Also store reusable reply templates that managers can pick from.

CREATE TABLE IF NOT EXISTS "marketplace_messages" (
  "id" SERIAL PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "external_thread_id" TEXT NOT NULL,
  "external_listing_id" TEXT,
  "listing_title" TEXT,
  "buyer_name" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "is_from_buyer" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "received_at" TIMESTAMP(3) NOT NULL,
  "first_responded_at" TIMESTAMP(3),
  "assigned_to" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_messages_platform_external_thread_id_key" UNIQUE ("platform", "external_thread_id"),
  CONSTRAINT "marketplace_messages_assigned_to_fkey" FOREIGN KEY ("assigned_to")
    REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "marketplace_messages_platform_is_read_idx"
  ON "marketplace_messages" ("platform", "is_read");
CREATE INDEX IF NOT EXISTS "marketplace_messages_received_at_idx"
  ON "marketplace_messages" ("received_at" DESC);
CREATE INDEX IF NOT EXISTS "marketplace_messages_assigned_to_idx"
  ON "marketplace_messages" ("assigned_to");

CREATE TABLE IF NOT EXISTS "marketplace_reply_templates" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
