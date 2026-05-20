ALTER TABLE "reviews"
    ADD COLUMN "sentiment" VARCHAR(20),
    ADD COLUMN "ai_suggested_reply" VARCHAR(1000),
    ADD COLUMN "ai_classified_at" TIMESTAMP(3);

CREATE INDEX "reviews_sentiment_idx" ON "reviews"("sentiment");
