-- B6: Proration credit. Tracks unused-days value when a tenant upgrades or
-- downgrades mid-cycle so the next invoice doesn't double-charge them for
-- overlapping days under the old plan.
--
-- B8: Per-tenant gap-free invoice numbering. UA "Закон про бухоблік" art. 9
-- requires sequential, gap-free invoice numbers. Auto-increment ID leaks
-- gaps when rows are deleted, so we maintain a per-tenant counter.
--
-- All columns ADD with DEFAULT — metadata change in Postgres 11+, runs
-- online without table rewrite.

ALTER TABLE "tenant_billings"
  ADD COLUMN "prorated_credit" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoice_counter" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "billing_invoices"
  ADD COLUMN "invoice_number" TEXT,
  ADD COLUMN "prorated_credit" DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "billing_invoices_invoice_number_key"
  ON "billing_invoices"("invoice_number");

CREATE INDEX "billing_invoices_billingId_invoiceNumber_idx"
  ON "billing_invoices"("billing_id", "invoice_number");
