import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getAllReferrals, getReferralStats } from '@/services/referral';
import { referralFilterSchema } from '@/validators/referral';
import { errorResponse, paginatedResponse, successResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);

    if (params.stats === 'true') {
      const stats = await getReferralStats();
      return successResponse(stats);
    }

    const parsed = referralFilterSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { items, total } = await getAllReferrals(parsed.data);
    return paginatedResponse(items, total, parsed.data.page, parsed.data.limit);
  } catch (err) {
    logger.error('[admin/referrals] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
