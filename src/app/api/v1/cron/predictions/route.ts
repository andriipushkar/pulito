import { NextRequest } from 'next/server';
import { buildPredictions, processReminders } from '@/services/purchase-prediction';
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

    const predictionsBuilt = await buildPredictions();
    const remindersSent = await processReminders();

    return successResponse({
      predictionsBuilt,
      remindersSent,
      message: `Побудовано ${predictionsBuilt} прогнозів, надіслано ${remindersSent} нагадувань`,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
