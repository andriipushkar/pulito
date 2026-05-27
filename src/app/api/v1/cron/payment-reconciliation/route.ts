import { NextRequest } from 'next/server';
import { reconcileStuckPayments } from '@/services/jobs/payment-reconciliation';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    // Prefer dedicated CRON_SECRET; fall back to APP_SECRET for backwards
    // compat with existing cron registrations. Once all crons rotate to
    // CRON_SECRET we can drop the fallback and require it.
    const cronSecret = env.CRON_SECRET || env.APP_SECRET;
    const expectedToken = `Bearer ${cronSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const result = await reconcileStuckPayments();
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
