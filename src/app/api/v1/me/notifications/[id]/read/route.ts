import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { markAsRead } from '@/services/notification';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PUT = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { id } = await params!;
    const n = Number(id);
    // `isNaN(-5) === false` — guard with positive-integer check so the
    // service receives only valid notification IDs.
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      return errorResponse('Невалідний ID', 400);
    }
    await markAsRead(n, user.id);
    return successResponse({ success: true });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
