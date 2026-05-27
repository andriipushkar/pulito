import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Default retention windows by action type. Critical security events stay
 * longer because we may need them for incident response months after the fact.
 * Financial / commercial actions stay 3 years per UA «Закон про бухоблік»
 * ст. 44 — tax inspections look back 1095 days, deleting earlier puts the
 * merchant at risk during an audit.
 *
 * Anything not listed here uses DEFAULT_RETENTION_DAYS.
 */
const THREE_YEARS = 365 * 3;

const RETENTION_DAYS_BY_ACTION: Record<string, number> = {
  // Security: 1 year covers incident-response windows.
  login: 365,
  logout: 365,
  password_reset: 365,
  role_change: 365,
  user_block: 365,
  user_unblock: 365,
  // Financial / commercial: 3 years (UA accounting compliance).
  data_create: THREE_YEARS,
  data_update: THREE_YEARS,
  data_delete: THREE_YEARS,
  order_status_change: THREE_YEARS,
  rule_change: THREE_YEARS,
  import_action: THREE_YEARS,
  gdpr_export: THREE_YEARS,
  wholesale_approve: THREE_YEARS,
  wholesale_reject: THREE_YEARS,
};

const DEFAULT_RETENTION_DAYS = 180;

export interface CleanupResult {
  deleted: number;
  byActionType: Record<string, number>;
}

/**
 * Deletes audit-log rows older than their per-action retention window.
 * Runs in small batches to keep transactions short — large deleteMany on a
 * busy table can lock-step new inserts.
 */
export async function cleanupAuditLog(batchSize = 1000): Promise<CleanupResult> {
  const now = Date.now();
  const result: CleanupResult = { deleted: 0, byActionType: {} };

  const actionTypes = Object.keys(RETENTION_DAYS_BY_ACTION);

  // 1. Per-action retention for the "long-keep" set.
  for (const actionType of actionTypes) {
    const cutoff = new Date(now - RETENTION_DAYS_BY_ACTION[actionType] * 86_400_000);
    let totalForType = 0;
    while (true) {
      const batch = await prisma.auditLog.findMany({
        where: { actionType: actionType as never, createdAt: { lt: cutoff } },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const { count } = await prisma.auditLog.deleteMany({
        where: { id: { in: batch.map((r) => r.id) } },
      });
      totalForType += count;
      result.deleted += count;
      if (batch.length < batchSize) break;
    }
    if (totalForType > 0) result.byActionType[actionType] = totalForType;
  }

  // 2. Default retention for everything else.
  const defaultCutoff = new Date(now - DEFAULT_RETENTION_DAYS * 86_400_000);
  let defaultDeleted = 0;
  while (true) {
    const batch = await prisma.auditLog.findMany({
      where: {
        actionType: { notIn: actionTypes as never[] },
        createdAt: { lt: defaultCutoff },
      },
      select: { id: true },
      take: batchSize,
    });
    if (batch.length === 0) break;
    const { count } = await prisma.auditLog.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });
    defaultDeleted += count;
    result.deleted += count;
    if (batch.length < batchSize) break;
  }
  if (defaultDeleted > 0) result.byActionType['_default'] = defaultDeleted;

  logger.info('Audit log cleanup completed', {
    deleted: result.deleted,
    byActionType: result.byActionType,
  } as Record<string, unknown>);

  // Self-audit: leave a trail of WHO/WHEN/HOW-MUCH was cleaned. Without this,
  // a malicious cron caller could shred evidence and leave no record they
  // did so. userId 0 = system actor.
  if (result.deleted > 0) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: 0,
          actionType: 'data_delete',
          entityType: 'audit_log_cleanup',
          details: {
            deleted: result.deleted,
            byActionType: result.byActionType,
            source: 'cron:cleanup-audit-log',
          } as never,
        },
      });
    } catch (err) {
      logger.warn('[cleanup-audit-log] self-audit write failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
