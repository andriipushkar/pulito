import { NextRequest } from 'next/server';
import { processLoyaltyStreaks } from '@/services/jobs/loyalty-streaks';
import { processBirthdayBonuses } from '@/services/jobs/loyalty-birthday';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const [streaks, birthdays] = await Promise.all([
      processLoyaltyStreaks(),
      processBirthdayBonuses(),
    ]);

    return successResponse({ streaks, birthdays });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
