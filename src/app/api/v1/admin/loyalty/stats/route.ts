import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getLoyaltyStats } from '@/services/loyalty';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const daysParam = request.nextUrl.searchParams.get('days');
    const days = daysParam ? Math.max(1, Math.min(365, Number(daysParam) || 30)) : 30;
    const stats = await getLoyaltyStats({ days });
    return successResponse(stats);
  } catch {
    return errorResponse('Не вдалося завантажити статистику', 500);
  }
});
