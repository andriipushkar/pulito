import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateAnalyticsPdf } from '@/services/analytics-pdf';
import { logger } from '@/lib/logger';
import { parseDays } from '@/utils/analytics-days';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Two-layer limit: per-minute (`adminExport`) catches click-spam, and
    // the per-day cap below stops a stuck script (or hijacked session)
    // from running through 14k PDF renders overnight.
    const rlMinute = await checkRateLimit(`u${user.id}`, RATE_LIMITS.adminExport);
    if (!rlMinute.allowed) {
      return errorResponse(`Забагато експортів. Спробуйте через ${rlMinute.retryAfter}с`, 429);
    }
    const rlDay = await checkRateLimit(`u${user.id}`, RATE_LIMITS.adminPdfExport);
    if (!rlDay.allowed) {
      return errorResponse(`Денний ліміт PDF-експорту вичерпано. Спробуйте завтра.`, 429);
    }
    const body = await request.json();
    const { reportType, days: rawDays = 30 } = body;
    const days = parseDays(rawDays, 30);

    const validTypes = ['stock', 'price', 'channels', 'geography', 'ltv', 'segments', 'summary'];
    if (!validTypes.includes(reportType)) {
      return errorResponse(`Невірний тип звіту. Допустимі: ${validTypes.join(', ')}`, 400);
    }

    const pdfUrl = await generateAnalyticsPdf(reportType, days);
    return successResponse({ url: pdfUrl });
  } catch (err) {
    logger.error('[admin/analytics/export-pdf] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
