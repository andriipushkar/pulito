-- Supplier payouts ledger — record settlements paid to suppliers so the
-- reconciliation report can show owed vs paid. Hand-authored (not migrate diff)
-- to avoid the search_vector drift trap (see project_search_vector_fix).

-- CreateTable
CREATE TABLE "supplier_payouts" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "period_from" TIMESTAMP(3),
    "period_to" TIMESTAMP(3),
    "note" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payouts_supplier_id_created_at_idx" ON "supplier_payouts"("supplier_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "supplier_payouts" ADD CONSTRAINT "supplier_payouts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
