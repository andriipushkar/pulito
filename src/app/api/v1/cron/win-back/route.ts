import { NextRequest } from 'next/server';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { runWinBackCampaign } from '@/services/win-back';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Daily cron to email a 10% discount to customers who haven't ordered in 60-180 days.
 * Each user is throttled to at most one email every 90 days.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${env.APP_SECRET}`;
  if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
    return errorResponse('Unauthorized', 401);
  }
  try {
    const result = await runWinBackCampaign();
    return successResponse(result);
  } catch (err) {
    logger.error('win-back cron failed', { error: String(err) });
    return errorResponse('Помилка win-back', 500);
  }
}
