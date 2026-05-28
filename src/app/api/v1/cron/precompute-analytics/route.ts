import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';

/**
 * Pre-compute heavy analytics and cache results.
 * Run daily via cron to keep analytics instant for admin users.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // Distributed lock so an overlapping cron fire (clock skew / double trigger)
    // doesn't run the heavy precompute twice concurrently.
    const locked = await withCronLock('precompute-analytics', 900, async () => {
      const appUrl = `http://localhost:${env.PORT || 3000}`;
      const types = ['sales', 'products', 'clients', 'orders', 'dashboard'];
      const periods = [7, 30, 90];
      let cached = 0;

      for (const type of types) {
        for (const days of periods) {
          try {
            // Call the analytics endpoint internally to populate cache
            await fetch(`${appUrl}/api/v1/admin/analytics?type=${type}&days=${days}`, {
              headers: {
                Authorization: request.headers.get('authorization') || '',
                'X-Requested-With': 'XMLHttpRequest',
              },
              signal: AbortSignal.timeout(30000),
            });
            cached++;
          } catch {
            // Some analytics types may not exist for all periods
          }
        }
      }

      return { precomputed: cached, types: types.length, periods: periods.length };
    });

    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous run in flight' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse("Помилка прекомп'ютації аналітики", 500);
  }
}
