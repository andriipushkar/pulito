import { NextRequest } from 'next/server';
import { processNotificationQueue } from '@/services/notification-queue';
import { cleanupExpiredNotifications } from '@/services/notification';
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

    const [queueResult, cleanupResult] = await Promise.all([
      processNotificationQueue(),
      cleanupExpiredNotifications(90),
    ]);

    return successResponse({ queue: queueResult, cleanup: cleanupResult });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
