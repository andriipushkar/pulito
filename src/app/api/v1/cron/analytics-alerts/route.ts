import { NextRequest } from 'next/server';
import { checkAnalyticsAlerts } from '@/services/jobs/check-analytics-alerts';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // Lock so an overlapping cron fire doesn't double-send alert notifications.
    const locked = await withCronLock('analytics-alerts', 600, () => checkAnalyticsAlerts());
    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous run in flight' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
