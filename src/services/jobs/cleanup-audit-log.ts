import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Default retention windows by action type. Critical security events stay
 * longer because we may need them for incident response months after the fact.
 *
 * Anything not listed here uses DEFAULT_RETENTION_DAYS.
 */
const RETENTION_DAYS_BY_ACTION: Record<string, number> = {
  // Security-critical: keep for a year
  login: 365,
  logout: 365,
  password_reset: 365,
  role_change: 365,
  user_block: 365,
  user_unblock: 365,
  data_delete: 365,
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
  return result;
}
