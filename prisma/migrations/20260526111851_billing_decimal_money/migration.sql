-- Convert billing money fields from FLOAT to DECIMAL(10, 2). Float is exact
-- for whole numbers but silently rounds fractions (`10.005` → `10.0049...`
-- in IEEE 754), producing audit/refund drift over time. Decimal is the
-- standard for currency in Postgres.
--
-- Safety: USING clause lets PG cast existing values; for typical plan
-- prices (under 1M UAH) there's no overflow risk.
-- This requires a table rewrite on the affected columns — fast on the
-- billing tables (few rows in steady state) but should be deployed during
-- low-traffic window if invoices count is large.

ALTER TABLE "plans"
  ALTER COLUMN "price_monthly" TYPE DECIMAL(10, 2) USING "price_monthly"::DECIMAL(10, 2),
  ALTER COLUMN "price_monthly" SET DEFAULT 0,
  ALTER COLUMN "price_yearly" TYPE DECIMAL(10, 2) USING "price_yearly"::DECIMAL(10, 2),
  ALTER COLUMN "price_yearly" SET DEFAULT 0;

ALTER TABLE "billing_invoices"
  ALTER COLUMN "amount" TYPE DECIMAL(10, 2) USING "amount"::DECIMAL(10, 2),
  ALTER COLUMN "amount" SET DEFAULT 0;
