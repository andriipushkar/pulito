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
    const rl = await checkRateLimit(`u${user.id}`, RATE_LIMITS.adminExport);
    if (!rl.allowed) {
      return errorResponse(`Забагато експортів. Спробуйте через ${rl.retryAfter}с`, 429);
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
