import { NextRequest } from 'next/server';
import { processBackInStockNotifications } from '@/services/back-in-stock';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/cron/back-in-stock
 * Authorized with Bearer APP_SECRET. Intended to be called by a scheduler
 * (cron, GitHub Actions, Vercel Cron) once every 30-60 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const result = await processBackInStockNotifications();
    return successResponse(result);
  } catch (err) {
    logger.error('[cron/back-in-stock] failed', { error: String(err) });
    return errorResponse('Internal error', 500);
  }
}
