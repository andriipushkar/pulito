import { NextRequest } from 'next/server';
import { alertSafetyStock } from '@/services/jobs/safety-stock-alert';
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
    const threshold = Number(request.nextUrl.searchParams.get('threshold')) || 5;
    const result = await alertSafetyStock(threshold);
    return successResponse(result);
  } catch {
    return errorResponse('Помилка safety-stock alert', 500);
  }
}
