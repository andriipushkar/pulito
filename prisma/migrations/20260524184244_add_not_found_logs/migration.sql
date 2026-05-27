-- CreateTable
CREATE TABLE "not_found_logs" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "user_agent" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "not_found_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "not_found_logs_path_key" ON "not_found_logs"("path");

-- CreateIndex
CREATE INDEX "not_found_logs_last_seen_at_idx" ON "not_found_logs"("last_seen_at" DESC);

-- CreateIndex
CREATE INDEX "not_found_logs_count_idx" ON "not_found_logs"("count" DESC);
