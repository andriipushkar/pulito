-- Track cumulative refunded amount per payment. Defaults to 0 for existing
-- rows. Adding a column with a constant default is a metadata change in
-- Postgres 11+, safe to run online without table rewrite.
--
-- Used by `refundPayment` to prevent over-refund even if paymentStatus is
-- manually flipped back to `paid` (e.g. via an admin console patch).

ALTER TABLE "payments"
  ADD COLUMN "refunded_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0;
