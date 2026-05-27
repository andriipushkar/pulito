import { NextRequest } from 'next/server';
import { autoAssignBadges } from '@/services/badge';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    // Prefer CRON_SECRET (rotatable) over APP_SECRET, which doubles as the
    // encryption-key salt and can't be rotated. Falls back for older deploys.
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expectedToken = `Bearer ${cronSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // Cron lock prevents overlapping runs from racing on the same product
    // rows via createMany. 10 min covers the slowest expected catalog scan.
    const { withCronLock } = await import('@/lib/cron-lock');
    const lockResult = await withCronLock('auto-badges', 600, () => autoAssignBadges());
    if (!lockResult.acquired) {
      return successResponse({ skipped: true, reason: 'auto-badges cron is already running' });
    }

    return successResponse(lockResult.result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
