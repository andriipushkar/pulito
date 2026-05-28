import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { subscribePush, getVapidPublicKey } from '@/services/push';

// Push endpoints come from well-known providers (FCM, Mozilla, Apple).
// Cap at 2KB — real endpoints are ~150 chars — and require https:// to stop
// http://malicious-host registration.
const pushSubscribeSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((v) => v.startsWith('https://'), { message: 'Push endpoint має бути https' }),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
    if (!rl.allowed) return errorResponse('Забагато спроб', 429);

    const body = await request.json();
    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідна підписка', 422);
    }

    await subscribePush(user.id, parsed.data);

    return successResponse({ subscribed: true });
  } catch {
    return errorResponse('Помилка підписки на push-сповіщення', 500);
  }
});

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return errorResponse('VAPID не налаштовано', 503);
  }
  return successResponse({ publicKey });
}
