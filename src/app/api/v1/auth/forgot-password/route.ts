import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/services/verification';
import { checkRateLimit, RATE_LIMITS, RateLimitError } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getClientIp } from '@/utils/request';
import { logAudit } from '@/services/audit';
import { prisma } from '@/lib/prisma';

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

    // Look up the user to attribute the audit entry. We always return the same
    // response below to prevent email enumeration, but the audit row needs the
    // userId for accountability — emails that don't match are still recorded
    // with userId=null so we can spot fishing attempts.
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    await logAudit({
      userId: user?.id ?? null,
      actionType: 'password_reset',
      entityType: 'user',
      entityId: user?.id ?? null,
      details: { action: 'forgot_password_requested', email: parsed.data.email, matched: !!user },
      ipAddress: ip,
    });

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
