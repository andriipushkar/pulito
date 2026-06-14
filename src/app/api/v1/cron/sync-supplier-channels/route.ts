import { NextRequest } from 'next/server';
import { CronExpressionParser } from 'cron-parser';
import { prisma } from '@/lib/prisma';
import { SupplierChannelError } from '@/services/supplier-channel';
import { runSupplierSync } from '@/services/suppliers/dispatch';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

/**
 * Cron-runner for supplier channels.
 *
 * Called frequently (e.g. every 5 minutes) by the system cron. For each
 * channel with a non-null `scheduleCron`, computes "previous fire time" of
 * the cron expression — if that's between `lastSyncAt` (or epoch) and now,
 * the channel is due and we sync. This way the same trigger fires once even
 * if the system cron has 5-minute resolution and the channel cron is
 * "0 8 * * *" (would otherwise fire 12 times within an hour).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    // Prefer dedicated CRON_SECRET; fall back to APP_SECRET for backwards
    // compatibility — matches every other cron route and cron-run.sh, so this
    // job doesn't silently 401 (and stop syncing) once CRON_SECRET is set.
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expectedToken = `Bearer ${cronSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const now = new Date();

    // ImportLog.managerId is FK-constrained to User. For automated syncs we
    // attribute to the first admin — operators still know "the system did
    // it" via the filename pattern `supplier-{channelId}-...`.
    const systemAdmin = await prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!systemAdmin) {
      return errorResponse('No admin user found — cron cannot attribute import logs', 500);
    }

    const channels = await prisma.supplierChannel.findMany({
      where: {
        isActive: true,
        scheduleCron: { not: null },
      },
      select: { id: true, name: true, scheduleCron: true, lastSyncAt: true },
    });

    const ran: { id: number; result: { created: number; updated: number; skipped: number } }[] = [];
    const skipped: { id: number; reason: string }[] = [];
    const failed: { id: number; error: string }[] = [];

    for (const channel of channels) {
      if (!channel.scheduleCron) continue;
      let prevFireDate: Date;
      try {
        const interval = CronExpressionParser.parse(channel.scheduleCron, { currentDate: now });
        prevFireDate = interval.prev().toDate();
      } catch (err) {
        skipped.push({
          id: channel.id,
          reason: `invalid cron: ${err instanceof Error ? err.message : 'parse error'}`,
        });
        continue;
      }

      const since = channel.lastSyncAt ?? new Date(0);
      if (prevFireDate <= since) {
        // Already ran for this cron tick.
        skipped.push({ id: channel.id, reason: 'not due' });
        continue;
      }

      try {
        const run = await runSupplierSync(channel.id, systemAdmin.id);
        ran.push({
          id: channel.id,
          result: {
            created: run.created,
            updated: run.updated,
            skipped: run.skipped,
          },
        });
        logger.info(`[cron/sync-supplier-channels] #${channel.id} (${channel.name}) ok`, {
          mode: run.mode,
          created: run.created,
          updated: run.updated,
        });
      } catch (err) {
        const msg =
          err instanceof SupplierChannelError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'unknown';
        failed.push({ id: channel.id, error: msg });
        logger.error(`[cron/sync-supplier-channels] #${channel.id} failed: ${msg}`);
        // Alert the manager — a silently stale feed is the main risk of auto-sync.
        import('@/services/telegram')
          .then((mod) => mod.notifyManagerSupplierFailed(channel.name, msg))
          .catch(() => {
            /* best-effort */
          });
      }
    }

    return successResponse({
      ranCount: ran.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      ran,
      skipped,
      failed,
    });
  } catch (err) {
    logger.error('[cron/sync-supplier-channels] POST failed', { error: err });
    return errorResponse(err instanceof Error ? err.message : 'Внутрішня помилка сервера', 500);
  }
}
