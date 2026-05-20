ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'impersonate_start';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'impersonate_stop';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'gdpr_export';
