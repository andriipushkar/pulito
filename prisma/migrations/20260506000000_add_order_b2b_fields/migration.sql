-- Add B2B (legal entity) fields to orders.
-- These were validated in checkoutSchema but never persisted, losing buyer's
-- ЄДРПОУ/назву for invoice generation.
ALTER TABLE "orders"
  ADD COLUMN "company_name" TEXT,
  ADD COLUMN "edrpou" TEXT;
