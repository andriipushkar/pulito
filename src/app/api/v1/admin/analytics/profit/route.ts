import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { privateResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logger } from '@/lib/logger';
import { getProfitReport } from '@/services/profit-report';
import { todayKyivIso, kyivDateIso, daysAgoKyiv } from '@/utils/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Profit (revenue − COGS) report over a Kyiv date range. Defaults to the last
 * 30 days. no-store — it's financial.
 */
export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`u${user.id}`, RATE_LIMITS.admin);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter}с`, 429);
    }

    const sp = request.nextUrl.searchParams;
    const from = sp.get('from') || kyivDateIso(daysAgoKyiv(30));
    const to = sp.get('to') || todayKyivIso();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return errorResponse('Дати мають бути у форматі YYYY-MM-DD', 400);
    }
    if (from > to) return errorResponse('Початкова дата пізніша за кінцеву', 400);

    const report = await getProfitReport({ from, to });
    return privateResponse(report);
  } catch (err) {
    logger.error('[admin/analytics/profit] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
