-- Optimistic concurrency control: version column on hot-edited catalog tables.
-- PUT routes will check that the version sent by the client matches and
-- atomically increment; mismatches return 409 instead of silently overwriting
-- a concurrent admin's edit.
ALTER TABLE "products"   ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brands"     ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Supplier channels: pull product feeds from external URLs on a schedule
-- (manual sync now; cron field reserved for future scheduled sync).
CREATE TYPE "SupplierFormat" AS ENUM ('xlsx', 'csv', 'yml', 'xml_1c');
CREATE TYPE "SupplierAuthType" AS ENUM ('none', 'basic', 'bearer');

CREATE TABLE "supplier_channels" (
  "id"                  SERIAL PRIMARY KEY,
  "name"                VARCHAR(255) NOT NULL,
  "feed_url"            TEXT NOT NULL,
  "format"              "SupplierFormat" NOT NULL,
  "auth_type"           "SupplierAuthType" NOT NULL DEFAULT 'none',
  "auth_username"       TEXT,
  "auth_password"       TEXT,
  "auth_token"          TEXT,
  "is_active"           BOOLEAN NOT NULL DEFAULT true,
  "schedule_cron"       TEXT,
  "last_sync_at"        TIMESTAMP(3),
  "last_import_log_id"  INTEGER,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
