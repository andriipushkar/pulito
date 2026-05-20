import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { adjustPoints, LoyaltyError } from '@/services/loyalty';
import { adjustPointsSchema } from '@/validators/loyalty';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = adjustPointsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    await adjustPoints(parsed.data);
    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof LoyaltyError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/loyalty/adjust] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
