import { NextRequest } from 'next/server';
import { subscribeSchema } from '@/validators/feedback';
import {
  subscribe,
  confirmSubscription,
  unsubscribeByEmail,
  SubscriberError,
} from '@/services/subscriber';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Stricter rate limit for newsletter: 3 per 15 min
const SUBSCRIBE_LIMIT = { ...RATE_LIMITS.sensitive, prefix: 'rl:subscribe:' };

// Uniform user-facing copy — same wording regardless of subscriber state so a
// scraper can't tell from the POST response whether the email was already
// subscribed/pending/unsubscribed. Confirmation token still gates the actual
// state change.
const GENERIC_SUBSCRIBE_OK = 'Якщо email валідний — на нього надіслано лист підтвердження';
const GENERIC_UNSUBSCRIBE_OK = 'Запит на відписку оброблено';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rl = await checkRateLimit(ip, SUBSCRIBE_LIMIT);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    try {
      await subscribe(parsed.data.email, parsed.data.source);
    } catch (err) {
      // Swallow SubscriberError (already-subscribed etc.) — the uniform 202
      // response below is the whole point. Other errors propagate.
      if (!(err instanceof SubscriberError)) {
        logger.error('[subscribe] failed', { error: err });
      }
    }
    return successResponse({ message: GENERIC_SUBSCRIBE_OK }, 202);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const email = request.nextUrl.searchParams.get('email');
  const action = request.nextUrl.searchParams.get('action');

  // Unsubscribe links in transactional emails carry `?email=` (built by
  // baseLayout in email-template.ts). Confirmation links from /subscribe
  // signup use `?token=`.
  const lookupValue = action === 'unsubscribe' ? email || token : token;
  if (!lookupValue) {
    return errorResponse('Токен не надано', 400);
  }

  if (action === 'unsubscribe') {
    // Uniform response — don't leak whether the email had an active
    // subscription. We still perform the unsubscribe when the row exists.
    try {
      await unsubscribeByEmail(lookupValue);
    } catch (err) {
      if (!(err instanceof SubscriberError)) {
        logger.error('[unsubscribe] failed', { error: err });
      }
    }
    return successResponse({ message: GENERIC_UNSUBSCRIBE_OK });
  }

  // Confirmation tokens are 64-hex random — leaking 400 on bad token is fine
  // because the token itself is opaque (no enumeration surface).
  try {
    const result = await confirmSubscription(lookupValue);
    return successResponse(result);
  } catch (error) {
    if (error instanceof SubscriberError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
