-- Soft Delete: Add deletedAt to products and categories
ALTER TABLE "products" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "categories" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Indexes for efficient cleanup cron jobs
CREATE INDEX "webhook_logs_processed_at_idx" ON "webhook_logs"("processed_at");
CREATE INDEX "login_history_created_at_idx" ON "login_history"("created_at");
