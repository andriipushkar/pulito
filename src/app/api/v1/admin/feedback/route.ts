import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { feedbackFilterSchema } from '@/validators/feedback';
import { getFeedbackList } from '@/services/feedback';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = feedbackFilterSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { items, total } = await getFeedbackList(parsed.data);
    return paginatedResponse(items, total, parsed.data.page, parsed.data.limit);
  } catch (err) {
    logger.error('[admin/feedback] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
