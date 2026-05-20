import { NextRequest } from 'next/server';
import {
  processSubscriptionReminders,
  processFailedSubscriptionPayments,
} from '@/services/jobs/process-subscriptions';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

// Runs daily (cron schedule, e.g. 09:00) to:
//   1. Send pre-delivery reminders for subscriptions whose remindAt is due
//   2. Sweep failed payments: bump retry count or pause after 2 failures
//
// Order of operations matters — failed-payment sweep can mutate
// `nextDeliveryAt`, which influences the next remindAt cycle.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const reminders = await processSubscriptionReminders();
    const failures = await processFailedSubscriptionPayments();

    return successResponse({
      reminders,
      failures,
      message: `Reminders sent: ${reminders.sent}/${reminders.total}. Retries: ${failures.retried}, paused: ${failures.paused}`,
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : 'Внутрішня помилка сервера',
      500,
    );
  }
}
