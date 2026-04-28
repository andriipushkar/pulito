import { NextRequest } from 'next/server';
import { autoPostPromoToTelegram } from '@/services/jobs/promo-autopost';
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

    const url = new URL(request.url);
    const batchSizeParam = Number(url.searchParams.get('batchSize'));
    const batchSize =
      Number.isFinite(batchSizeParam) && batchSizeParam > 0 ? Math.min(batchSizeParam, 20) : 5;

    const result = await autoPostPromoToTelegram(batchSize);
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
