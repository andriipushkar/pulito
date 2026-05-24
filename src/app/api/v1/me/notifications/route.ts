import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getUserNotifications, markAllAsRead } from '@/services/notification';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const page = Number(request.nextUrl.searchParams.get('page')) || 1;
    const limit = Number(request.nextUrl.searchParams.get('limit')) || 20;

    const result = await getUserNotifications(user.id, { page, limit });
    return privateResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withAuth(async (_request: NextRequest, { user }) => {
  try {
    await markAllAsRead(user.id);
    return successResponse({ success: true });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
