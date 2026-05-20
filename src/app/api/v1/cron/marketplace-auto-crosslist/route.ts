import { NextRequest } from 'next/server';
import { runAutoCrosslist } from '@/services/marketplace-auto-crosslist';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const locked = await withCronLock('marketplace-auto-crosslist', 1800, async () => {
      return runAutoCrosslist();
    });

    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous auto-crosslist still running' });
    }
    return successResponse(locked.result);
  } catch (err) {
    logger.error('[Cron] auto-crosslist failed', { error: err });
    return errorResponse('Помилка auto-crosslist', 500);
  }
}
