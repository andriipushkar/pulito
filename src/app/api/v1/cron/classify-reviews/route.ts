import { NextRequest } from 'next/server';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { classifyPendingReviews } from '@/services/review-ai';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Periodic job to classify new reviews via Claude API. Runs in small batches
 * to control cost.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${env.APP_SECRET}`;
  if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
    return errorResponse('Unauthorized', 401);
  }
  try {
    const result = await classifyPendingReviews();
    return successResponse(result);
  } catch (err) {
    logger.error('classify-reviews cron failed', { error: String(err) });
    return errorResponse('Помилка класифікації', 500);
  }
}
