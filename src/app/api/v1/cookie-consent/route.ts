import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

const consentSchema = z.object({
  // Real session IDs from the client are crypto-random 32-64 chars; cap at
  // 128 so a malicious caller can't insert multi-KB blob rows.
  sessionId: z.string().min(1).max(128),
  analyticsAccepted: z.boolean().optional(),
  marketingAccepted: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(ip, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = consentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const consent = await prisma.cookieConsent.create({
      data: {
        sessionId: parsed.data.sessionId,
        analyticsAccepted: !!parsed.data.analyticsAccepted,
        marketingAccepted: !!parsed.data.marketingAccepted,
        ipAddress: ip === 'unknown' ? null : ip,
      },
    });

    return successResponse(consent, 201);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
