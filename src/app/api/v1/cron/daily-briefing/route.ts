import { NextRequest } from 'next/server';
import { sendDailyBriefing } from '@/services/jobs/daily-briefing';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

/**
 * POST /api/v1/cron/daily-briefing
 * Schedule from your cron runner at 08:00 Kyiv to deliver the AI summary
 * to admin/manager inboxes. Auth: Authorization: Bearer ${APP_SECRET}.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }
    const result = await sendDailyBriefing();
    return successResponse(result);
  } catch (err) {
    console.error('[cron/daily-briefing]', err);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
