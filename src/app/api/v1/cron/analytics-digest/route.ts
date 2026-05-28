import { NextRequest } from 'next/server';
import { sendAnalyticsDigest } from '@/services/jobs/analytics-digest';
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

    const { period = 'daily' } = await request.json().catch(() => ({ period: 'daily' }));

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return errorResponse('Невірний період. Допустимі: daily, weekly, monthly', 400);
    }

    // Lock per period so a double-fire doesn't email the digest twice. Daily/
    // weekly/monthly use distinct lock keys so they can still run independently.
    const locked = await withCronLock(`analytics-digest:${period}`, 600, () =>
      sendAnalyticsDigest(period as 'daily' | 'weekly' | 'monthly'),
    );
    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous run in flight' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
