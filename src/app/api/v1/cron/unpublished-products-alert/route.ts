import { NextRequest } from 'next/server';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { runUnpublishedProductsAlert } from '@/services/unpublished-products-alert';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Weekly cron: finds active in-stock products with zero marketplace listings
 * older than 14 days and pings the manager via Telegram so they can publish.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${env.APP_SECRET}`;
  if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
    return errorResponse('Unauthorized', 401);
  }
  try {
    const result = await runUnpublishedProductsAlert();
    return successResponse(result);
  } catch (err) {
    logger.error('unpublished-products-alert cron failed', { error: String(err) });
    return errorResponse('Помилка перевірки публікацій', 500);
  }
}
