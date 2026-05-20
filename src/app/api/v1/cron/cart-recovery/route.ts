import { NextRequest } from 'next/server';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { errorResponse, successResponse } from '@/utils/api-response';
import { runAbandonedCartRecovery } from '@/services/cart-recovery';
import { logger } from '@/lib/logger';

/**
 * Fires hourly. Looks for carts whose last activity falls inside the 1/24/72-hour
 * reminder windows and sends a recovery email per cart. See cart-recovery.ts for
 * the windowing logic.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${env.APP_SECRET}`;
  if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
    return errorResponse('Unauthorized', 401);
  }
  try {
    const results = await runAbandonedCartRecovery();
    return successResponse({ results });
  } catch (err) {
    logger.error('cart-recovery cron failed', { error: String(err) });
    return errorResponse('Помилка cart-recovery', 500);
  }
}
