-- Add telegram_username so the wholesale-client manager card can link to t.me/{username}
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_username" TEXT;
