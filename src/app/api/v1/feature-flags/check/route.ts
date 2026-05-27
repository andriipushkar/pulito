import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { isFeatureEnabled } from '@/services/feature-flag';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export const GET = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    // Public endpoint — capped per-IP to prevent flag enumeration via brute
    // forcing the key list. Real client makes a handful of checks per
    // page load, so 60/min/IP is comfortable. Cache headers below keep
    // re-checks off the DB entirely.
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Забагато запитів. Зачекайте ${rl.retryAfter} с.` },
        { status: 429 },
      );
    }
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return errorResponse("Параметр key обов'язковий", 400);
    }

    const enabled = await isFeatureEnabled(key, user?.id, user?.role);

    const res = successResponse({ enabled });
    // 30s cache (CDN + browser). Flag changes propagate within half a
    // minute — acceptable for non-critical client-side UI gating.
    res.headers.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    return res;
  } catch {
    return errorResponse('Помилка перевірки фічефлага', 500);
  }
});
