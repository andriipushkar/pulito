import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getUserReferralStats, ReferralError } from '@/services/referral';
import { privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const stats = await getUserReferralStats(user.id);
    return privateResponse(stats);
  } catch (error) {
    if (error instanceof ReferralError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
