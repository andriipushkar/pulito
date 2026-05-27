import { NextRequest } from 'next/server';
import { getPageBySlug } from '@/services/static-page';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.api);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const { slug } = await params;
    const page = await getPageBySlug(slug);
    if (!page) return errorResponse('Сторінку не знайдено', 404);
    // 5 min cache for individual pages — CMS content doesn't change often
    // and the storefront ISR is the primary path; this just absorbs the
    // direct-API hits.
    const res = successResponse(page);
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res;
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
