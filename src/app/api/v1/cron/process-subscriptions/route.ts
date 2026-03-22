import { NextRequest } from 'next/server';
import { processSubscriptionOrders } from '@/services/jobs/process-subscriptions';
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

    const result = await processSubscriptionOrders();
    return successResponse({
      ...result,
      message: `Оброблено: ${result.processed}, помилок: ${result.failed}, пропущено: ${result.skipped}`,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
