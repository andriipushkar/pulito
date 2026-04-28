import { NextRequest } from 'next/server';
import { aggregateYesterday, aggregateFunnelStats } from '@/services/jobs/funnel-aggregate';
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
    const dateParam = url.searchParams.get('date');

    if (dateParam) {
      const target = new Date(dateParam);
      if (Number.isNaN(target.getTime())) {
        return errorResponse('Невалідна дата', 400);
      }
      const result = await aggregateFunnelStats(target);
      return successResponse(result);
    }

    const result = await aggregateYesterday();
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
