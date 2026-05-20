import { NextRequest } from 'next/server';
import { expireLoyaltyPoints } from '@/services/jobs/expire-loyalty-points';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

// Schedule weekly (e.g. Sundays at 04:00) — points TTL is months-grained,
// daily runs would be wasteful.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expected = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expected)) {
      return errorResponse('Unauthorized', 401);
    }
    const result = await expireLoyaltyPoints();
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Помилка', 500);
  }
}
