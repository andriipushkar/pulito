import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getLoyaltyDashboard } from '@/services/loyalty';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const dashboard = await getLoyaltyDashboard(user.id);
    return privateResponse(dashboard);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
