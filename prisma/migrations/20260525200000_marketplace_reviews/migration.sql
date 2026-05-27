-- CreateTable
CREATE TABLE "marketplace_reviews" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "product_id" INTEGER,
    "external_listing_id" TEXT,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "comment" TEXT,
    "pros" VARCHAR(500),
    "cons" VARCHAR(500),
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "permalink" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_reviews_platform_external_id_key" ON "marketplace_reviews"("platform", "external_id");

-- CreateIndex
CREATE INDEX "marketplace_reviews_product_id_platform_idx" ON "marketplace_reviews"("product_id", "platform");

-- CreateIndex
CREATE INDEX "marketplace_reviews_reviewed_at_idx" ON "marketplace_reviews"("reviewed_at" DESC);

-- AddForeignKey
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
