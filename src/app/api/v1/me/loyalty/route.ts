import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getLoyaltyDashboard } from '@/services/loyalty';
import { privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const dashboard = await getLoyaltyDashboard(user.id);
    return privateResponse(dashboard);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
