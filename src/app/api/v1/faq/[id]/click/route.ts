import { NextRequest } from 'next/server';
import { incrementFaqClick } from '@/services/faq';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Click counter sorts FAQ search results — without a rate-limit a bot
    // can hammer the endpoint to artificially rank one item top. 30/min
    // per IP+FAQ-id is generous for a real user (they scroll, they don't
    // click 60 times) while blocking the trivial inflation script.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`ip:${ip}:faq:${numId}`, RATE_LIMITS.content);
    if (!rl.allowed) {
      return successResponse({ message: 'ok', skipped: true });
    }

    await incrementFaqClick(numId);
    return successResponse({ message: 'ok' });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
