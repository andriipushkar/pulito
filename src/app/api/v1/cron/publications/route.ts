import { NextRequest } from 'next/server';
import { publishScheduledPublications } from '@/services/jobs/publish-scheduled';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    // CRON_SECRET preferred — APP_SECRET doubles as encryption-key salt
    // and can't be rotated. Fall back to APP_SECRET for older deploys.
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expectedToken = `Bearer ${cronSecret}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // Without a lock two overlapping ticks both walk the "scheduled" queue,
    // each calling Telegram/Instagram for the same publication → duplicate
    // posts. 10 min covers the slowest expected fan-out across all channels.
    const { withCronLock } = await import('@/lib/cron-lock');
    const lockResult = await withCronLock('publish-scheduled-publications', 600, () =>
      publishScheduledPublications(),
    );
    if (!lockResult.acquired) {
      return successResponse({
        skipped: true,
        reason: 'publish-scheduled cron is already running',
      });
    }
    const result = lockResult.result!;

    return successResponse({
      ...result,
      message: `Опубліковано: ${result.published}, помилок: ${result.failed}`,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
