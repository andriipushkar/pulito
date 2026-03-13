import { NextRequest } from 'next/server';
import { cleanupStaleCarts } from '@/services/jobs/cleanup-carts';
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

    const deletedCount = await cleanupStaleCarts();
    return successResponse({ deletedCount, message: `Видалено ${deletedCount} прострочених елементів кошика` });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
