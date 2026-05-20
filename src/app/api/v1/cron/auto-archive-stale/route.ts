import { NextRequest } from 'next/server';
import { autoArchiveStaleListings } from '@/services/jobs/auto-archive-stale-listings';
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
    const locked = await withCronLock('auto-archive-stale', 1800, () =>
      autoArchiveStaleListings(),
    );
    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous run in flight' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse('Помилка auto-archive', 500);
  }
}
