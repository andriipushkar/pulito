import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getUserPredictions } from '@/services/purchase-prediction';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const predictions = await getUserPredictions(user.id);
    return successResponse({ predictions });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
