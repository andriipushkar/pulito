import { NextRequest } from 'next/server';
import { rotateClientEventsPartitions } from '@/services/jobs/partition-rotate';
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
    const ahead = Number(url.searchParams.get('monthsAhead'));
    const retention = Number(url.searchParams.get('retentionMonths'));

    const result = await rotateClientEventsPartitions(
      Number.isFinite(ahead) && ahead >= 0 ? Math.min(ahead, 12) : 2,
      Number.isFinite(retention) && retention > 0 ? Math.min(retention, 60) : 13,
    );
    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
