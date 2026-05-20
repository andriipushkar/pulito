-- Outbound webhook subscriptions. Each row defines an external URL the platform
-- pings when one of `events` fires (order.created, payment.received, etc.).
--
-- `webhook_deliveries` tracks every attempt so the UI can show retry stats and
-- the operator can spot a remote endpoint that's been failing for hours.

CREATE TABLE "webhook_subscriptions" (
  "id"          SERIAL PRIMARY KEY,
  "name"        VARCHAR(255) NOT NULL,
  "url"         TEXT NOT NULL,
  "secret"      VARCHAR(64) NOT NULL,
  "events"      TEXT[] NOT NULL DEFAULT '{}',
  "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "webhook_deliveries" (
  "id"              SERIAL PRIMARY KEY,
  "subscription_id" INTEGER NOT NULL,
  "event"           VARCHAR(64) NOT NULL,
  "payload"         JSONB,
  "status_code"     INTEGER,
  "error"           TEXT,
  "attempt"         INTEGER NOT NULL DEFAULT 1,
  "duration_ms"     INTEGER,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "webhook_deliveries_subscription_id_idx"
  ON "webhook_deliveries"("subscription_id", "created_at" DESC);

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
