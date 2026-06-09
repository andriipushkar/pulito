import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { mergeRecentlyViewed } from '@/services/recently-viewed';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

const mergeSchema = z.object({
  productIds: z.array(z.number().int().positive()).max(50),
});

// Called once on login by useRecentlyViewed to fold the guest's localStorage
// history into the account. Previously missing — the client POSTed here and got
// a 404, so guest browsing history was silently dropped at sign-in.
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    await mergeRecentlyViewed(user.id, parsed.data.productIds);
    return successResponse({ message: 'ok' });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
