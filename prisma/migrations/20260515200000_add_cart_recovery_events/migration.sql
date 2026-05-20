-- Track abandoned-cart recovery emails so the cron never sends a duplicate reminder
-- to the same user/level, even if it stutters or fires twice on the same window.
CREATE TABLE "cart_recovery_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reminder_level" INTEGER NOT NULL,
    "cart_snapshot" JSONB NOT NULL,
    "coupon_id" INTEGER,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3),
    "recovered_order_id" INTEGER,

    CONSTRAINT "cart_recovery_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cart_recovery_events_user_id_reminder_level_idx" ON "cart_recovery_events"("user_id", "reminder_level");
CREATE INDEX "cart_recovery_events_sent_at_idx" ON "cart_recovery_events"("sent_at");

ALTER TABLE "cart_recovery_events" ADD CONSTRAINT "cart_recovery_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_recovery_events" ADD CONSTRAINT "cart_recovery_events_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
