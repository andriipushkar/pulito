-- Add soft delete (deletedAt) to Order, User, and Payment models
-- These critical models previously used hard delete, which could cause
-- irreversible data loss for financial records and user data.

ALTER TABLE "orders" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Indexes for efficient soft-delete filtering
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");
