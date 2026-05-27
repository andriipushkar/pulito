import { NextRequest } from 'next/server';
import { expireLoyaltyPoints } from '@/services/jobs/expire-loyalty-points';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';

// Schedule weekly (e.g. Sundays at 04:00) — points TTL is months-grained,
// daily runs would be wasteful.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expected = `Bearer ${cronSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expected)) {
      return errorResponse('Unauthorized', 401);
    }
    // Cron lock prevents overlapping runs from double-expiring the same
    // points (decrement-twice → negative balance). 30-min window covers
    // the slowest realistic run.
    const result = await withCronLock('expire-loyalty', 1800, () => expireLoyaltyPoints());
    if (!result) {
      return successResponse({ skipped: true, reason: 'another expire-loyalty cron is running' });
    }
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Помилка', 500);
  }
}
