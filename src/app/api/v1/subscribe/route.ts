import { NextRequest } from 'next/server';
import { subscribeSchema } from '@/validators/feedback';
import { subscribe, confirmSubscription, unsubscribeByEmail, SubscriberError } from '@/services/subscriber';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

// Stricter rate limit for newsletter: 3 per 15 min
const SUBSCRIBE_LIMIT = { ...RATE_LIMITS.sensitive, prefix: 'rl:subscribe:' };

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rl = await checkRateLimit(ip, SUBSCRIBE_LIMIT);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const result = await subscribe(parsed.data.email, parsed.data.source);
    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof SubscriberError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const action = request.nextUrl.searchParams.get('action');

  if (!token) {
    return errorResponse('Токен не надано', 400);
  }

  try {
    if (action === 'unsubscribe') {
      const result = await unsubscribeByEmail(token);
      return successResponse(result);
    }

    const result = await confirmSubscription(token);
    return successResponse(result);
  } catch (error) {
    if (error instanceof SubscriberError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
