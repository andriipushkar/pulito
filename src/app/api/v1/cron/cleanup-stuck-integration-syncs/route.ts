import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

/**
 * Auto-fail `running` IntegrationSync rows older than the stuck-job window.
 *
 * Why: a sync row is set to `status:running` at the start of an import; on
 * normal completion it transitions to `completed` or `failed`. If the worker
 * crashes (OOM, deploy mid-sync, panic) the row stays `running` forever,
 * which:
 *   - misleads the admin UI ("sync still running…" for days)
 *   - blocks duplicate-protection logic that checks for in-flight syncs
 *   - hides real failures from the failed-count badge
 *
 * Window: 2 hours covers the slowest legit sync (full catalog product
 * import on a busy 1C instance ≈ 40 min), but trips well before next day's
 * scheduled run.
 */
const STUCK_WINDOW_HOURS = 2;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expectedToken = `Bearer ${cronSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const cutoff = new Date(Date.now() - STUCK_WINDOW_HOURS * 60 * 60 * 1000);
    const result = await prisma.integrationSync.updateMany({
      where: {
        status: 'running',
        OR: [
          { startedAt: { lt: cutoff } },
          // Fallback: row created (but startedAt never set) > window ago
          { startedAt: null, createdAt: { lt: cutoff } },
        ],
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorLog: {
          source: 'cleanup-stuck-integration-syncs',
          reason: `Sync exceeded ${STUCK_WINDOW_HOURS}h running window — auto-marked failed by cleanup cron`,
        },
      },
    });

    if (result.count > 0) {
      logger.warn(`[cleanup-stuck-integration-syncs] auto-failed ${result.count} stuck syncs`);
    }
    return successResponse({ autoFailedCount: result.count, windowHours: STUCK_WINDOW_HOURS });
  } catch (err) {
    logger.error('[cleanup-stuck-integration-syncs] cron failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
