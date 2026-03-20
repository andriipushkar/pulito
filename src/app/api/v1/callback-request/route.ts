import { NextRequest } from 'next/server';
import { callbackRequestSchema } from '@/validators/feedback';
import { createFeedback } from '@/services/feedback';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

// Stricter rate limit for public callback form: 3 requests per 15 minutes
const CALLBACK_LIMIT = { ...RATE_LIMITS.sensitive, prefix: 'rl:callback:' };

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rl = await checkRateLimit(ip, CALLBACK_LIMIT);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте через 15 хвилин.', 429);
    }
    const body = await request.json();
    const parsed = callbackRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const feedback = await createFeedback({
      name: parsed.data.name,
      phone: parsed.data.phone,
      message: parsed.data.message,
      type: 'callback',
    });

    // Notify manager via Telegram
    import('@/services/telegram')
      .then((mod) =>
        mod.notifyManagerFeedback({
          type: 'callback',
          name: parsed.data.name,
          phone: parsed.data.phone,
          message: parsed.data.message,
        })
      )
      .catch(() => {});

    return successResponse({ id: feedback.id, message: 'Запит на зворотний дзвінок створено' }, 201);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
