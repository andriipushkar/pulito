import { NextRequest } from 'next/server';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { importMarketplaceReviews } from '@/services/marketplace-reviews-import';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Daily cron: pulls latest reviews from Rozetka and Prom seller APIs into
 * `MarketplaceReview` so the storefront can show external social proof on
 * product pages alongside local Reviews.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${env.APP_SECRET}`;
  if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
    return errorResponse('Unauthorized', 401);
  }
  try {
    const result = await importMarketplaceReviews();
    return successResponse(result);
  } catch (err) {
    logger.error('import-marketplace-reviews cron failed', { error: String(err) });
    return errorResponse('Помилка імпорту відгуків', 500);
  }
}
