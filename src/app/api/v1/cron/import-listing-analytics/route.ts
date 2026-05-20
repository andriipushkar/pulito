import { NextRequest } from 'next/server';
import { importListingAnalytics } from '@/services/marketplace-listing-analytics';
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

    const locked = await withCronLock('import-listing-analytics', 600, () =>
      importListingAnalytics(),
    );
    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous run in flight' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse('Помилка імпорту analytics', 500);
  }
}
