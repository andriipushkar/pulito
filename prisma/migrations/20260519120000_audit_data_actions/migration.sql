-- Extend AuditActionType to log generic data_create / data_update actions
-- alongside the existing data_delete. Postgres requires ALTER TYPE ADD VALUE
-- to run outside a transaction; Prisma's migration runner handles that.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'data_create';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'data_update';
