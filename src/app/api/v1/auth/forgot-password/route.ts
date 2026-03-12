import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/services/verification';
import { checkRateLimit, RATE_LIMITS, RateLimitError } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getClientIp } from '@/utils/request';

const schema = z.object({
  email: z.string().email('Невірний формат email'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Strict rate limit: 3 password reset requests per 15 min per IP
    const rl = await checkRateLimit(ip, RATE_LIMITS.sensitive);
    if (!rl.allowed) {
      throw new RateLimitError('Забагато спроб. Спробуйте пізніше.', 429, rl.retryAfter);
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    await requestPasswordReset(parsed.data.email);

    // Always return success to prevent email enumeration
    return successResponse({
      message: 'Якщо акаунт з таким email існує, на нього буде надіслано інструкції для відновлення пароля',
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const res = errorResponse(error.message, error.statusCode);
      if (error.retryAfter) res.headers.set('Retry-After', String(error.retryAfter));
      return res;
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
