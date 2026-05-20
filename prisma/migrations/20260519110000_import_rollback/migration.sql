-- ImportLog: track which products were created/updated so we can undo
ALTER TABLE "import_log" ADD COLUMN "created_product_ids" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "import_log" ADD COLUMN "updated_product_ids" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "import_log" ADD COLUMN "rollbacked_at" TIMESTAMP(3);
ALTER TABLE "import_log" ADD COLUMN "rollbacked_by" INTEGER;
