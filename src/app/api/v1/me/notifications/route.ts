import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getUserNotifications, markAllAsRead } from '@/services/notification';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Clamp pagination: NaN from `Number()` would hit Prisma `take`/`skip`
    // and explode. Cap limit at 100 to keep the response small.
    const pageRaw = Number(request.nextUrl.searchParams.get('page'));
    const limitRaw = Number(request.nextUrl.searchParams.get('limit'));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 20;

    const result = await getUserNotifications(user.id, { page, limit });
    return privateResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withAuth(async (_request: NextRequest, { user }) => {
  try {
    // markAllAsRead writes the whole user's notification set; without a cap
    // a stuck UI button hammers the DB. cart bucket (30/min) is generous.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }
    await markAllAsRead(user.id);
    return successResponse({ success: true });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
