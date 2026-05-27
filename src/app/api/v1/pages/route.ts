import { NextRequest } from 'next/server';
import { getPublishedPages } from '@/services/static-page';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export async function GET(request: NextRequest) {
  try {
    // Public list — capped per-IP so a scraper can't hammer the DB. Result
    // also gets a 60s public Cache-Control header so CDN absorbs steady
    // navigation traffic without hitting Postgres at all.
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.api);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const pages = await getPublishedPages();
    const res = successResponse(pages);
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res;
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
