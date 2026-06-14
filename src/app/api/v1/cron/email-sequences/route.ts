import { NextRequest } from 'next/server';
import {
  processWelcomeSeries,
  processPostPurchaseReviewRequest,
  processLoyaltyExpiryWarnings,
} from '@/services/email-sequences';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // win-back is handled by the standalone /cron/win-back job (stronger
    // 90-day repeat guard + opt-out filter); intentionally not run here to
    // avoid double-mailing the same dormant customers.
    const [welcome, reviewRequest, loyaltyExpiry] = await Promise.allSettled([
      processWelcomeSeries(),
      processPostPurchaseReviewRequest(),
      processLoyaltyExpiryWarnings(),
    ]);

    return successResponse({
      welcome: welcome.status === 'fulfilled' ? welcome.value : { error: 'failed' },
      reviewRequest:
        reviewRequest.status === 'fulfilled' ? reviewRequest.value : { error: 'failed' },
      loyaltyExpiry:
        loyaltyExpiry.status === 'fulfilled' ? loyaltyExpiry.value : { error: 'failed' },
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
