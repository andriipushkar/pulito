CREATE TABLE "win_back_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "days_since_last_order" INTEGER NOT NULL,
    "coupon_id" INTEGER,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3),
    "recovered_order_id" INTEGER,

    CONSTRAINT "win_back_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "win_back_events_user_id_sent_at_idx" ON "win_back_events"("user_id", "sent_at");
CREATE INDEX "win_back_events_sent_at_idx" ON "win_back_events"("sent_at");

ALTER TABLE "win_back_events"
    ADD CONSTRAINT "win_back_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "win_back_events_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
