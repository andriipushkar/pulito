import { NextRequest } from 'next/server';
import { getPublishedFaq } from '@/services/faq';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.content);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }

    const faq = await getPublishedFaq();
    const res = successResponse(faq);
    // FAQ rarely changes; CDN/proxy can cache it. Admin PUT/DELETE calls
    // `revalidatePath('/faq')`, so the 5-min TTL is a soft floor.
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res;
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
