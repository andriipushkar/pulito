import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface RotateResult {
  partitionsCreated: string[];
  partitionsDropped: number;
  retentionMonths: number;
}

function startOfMonth(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  return out;
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 0, 0, 0));
}

/**
 * Ensure monthly partitions exist for the current month and the next
 * `monthsAhead`. Drops partitions older than `retentionMonths`.
 *
 * Default retention: 13 months (full year + current).
 */
export async function rotateClientEventsPartitions(
  monthsAhead = 2,
  retentionMonths = 13,
): Promise<RotateResult> {
  const created: string[] = [];

  const start = startOfMonth(new Date());
  for (let i = 0; i <= monthsAhead; i++) {
    const month = addMonths(start, i);
    const isoDate = month.toISOString().slice(0, 10);
    try {
      await prisma.$executeRawUnsafe(`SELECT ensure_client_events_partition($1::date)`, isoDate);
      created.push(isoDate);
    } catch (error) {
      logger.error('partition-rotate: ensure failed', {
        month: isoDate,
        error: String(error),
      });
    }
  }

  let dropped = 0;
  try {
    const result = await prisma.$queryRawUnsafe<
      Array<{ drop_old_client_events_partitions: number }>
    >(
      `SELECT drop_old_client_events_partitions($1::int) AS drop_old_client_events_partitions`,
      retentionMonths,
    );
    dropped = result[0]?.drop_old_client_events_partitions ?? 0;
  } catch (error) {
    logger.error('partition-rotate: drop_old failed', { error: String(error) });
  }

  return { partitionsCreated: created, partitionsDropped: dropped, retentionMonths };
}
