import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@/../generated/prisma';
import type { AuditActionType } from '@/../generated/prisma';

export interface AuditEntryInput {
  userId: number | null;
  actionType: AuditActionType;
  entityType: string;
  entityId?: number | null;
  details?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

/**
 * Central audit-log writer. Never throws — audit failures must not break the
 * action they're recording. If you need transactional guarantees (so the audit
 * row rolls back with the operation), pass a Prisma tx as the second arg.
 */
export async function logAudit(
  entry: AuditEntryInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  try {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: entry.userId ?? undefined,
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      ipAddress: entry.ipAddress ?? null,
    };
    if (entry.details !== undefined && entry.details !== null) {
      data.details = entry.details;
    }
    await client.auditLog.create({ data });
  } catch (error) {
    // Swallow but log: we don't want a missing audit row to fail a user action.
    // The transactional variant re-throws naturally because the tx is failing.
    if (tx) throw error;
    logger.error('Failed to write audit log', { error, entry });
  }
}
