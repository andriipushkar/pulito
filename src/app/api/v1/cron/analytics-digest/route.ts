import { NextRequest } from 'next/server';
import { sendAnalyticsDigest } from '@/services/jobs/analytics-digest';
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

    const { period = 'daily' } = await request.json().catch(() => ({ period: 'daily' }));

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return errorResponse('Невірний період. Допустимі: daily, weekly, monthly', 400);
    }

    const result = await sendAnalyticsDigest(period as 'daily' | 'weekly' | 'monthly');
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
