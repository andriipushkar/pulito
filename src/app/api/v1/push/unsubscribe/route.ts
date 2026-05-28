import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { unsubscribePush } from '@/services/push';

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Endpoint обов'язковий", 422);
    }

    await unsubscribePush(parsed.data.endpoint);

    return successResponse({ unsubscribed: true });
  } catch {
    return errorResponse('Помилка відписки від push-сповіщень', 500);
  }
});
