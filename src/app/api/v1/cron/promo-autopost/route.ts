import { NextRequest } from 'next/server';
import {
  autoPostPromoToTelegram,
  autoPostNewToTelegram,
  getAutopostConfig,
  currentKyivHour,
} from '@/services/jobs/promo-autopost';
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
    // `force=1` bypasses the admin schedule (a manual "post now" run). The
    // hourly cron omits it, so the admin-configured enable+hours gate each run.
    const force = url.searchParams.get('force') === '1';

    const config = await getAutopostConfig();

    if (!force) {
      if (!config.enabled) {
        return successResponse({ skipped: true, reason: 'disabled' });
      }
      const hour = currentKyivHour();
      if (!config.hours.includes(hour)) {
        return successResponse({ skipped: true, reason: 'not_scheduled_hour', hour });
      }
    }

    // Explicit ?batchSize override wins (manual runs); else use configured batch.
    const batchSizeParam = Number(url.searchParams.get('batchSize'));
    const batchSize =
      Number.isFinite(batchSizeParam) && batchSizeParam > 0
        ? Math.min(batchSizeParam, 20)
        : config.batchSize;

    // Post each enabled content type (promo + new arrivals), up to batchSize each.
    const promo = config.postPromo
      ? await autoPostPromoToTelegram(batchSize)
      : { scanned: 0, posted: 0, skipped: 0, errors: 0 };
    const fresh = config.postNew
      ? await autoPostNewToTelegram(batchSize)
      : { scanned: 0, posted: 0, skipped: 0, errors: 0 };

    return successResponse({
      promo,
      new: fresh,
      posted: promo.posted + fresh.posted,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
