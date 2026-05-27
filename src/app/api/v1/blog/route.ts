import { NextRequest } from 'next/server';
import { getPublishedPosts } from '@/services/blog';
import { paginatedResponse, errorResponse, parseSearchParams } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.api);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const { page, limit } = parseSearchParams(request.nextUrl.searchParams);
    const categorySlug = request.nextUrl.searchParams.get('category') || undefined;
    const tag = request.nextUrl.searchParams.get('tag') || undefined;

    const { posts, total } = await getPublishedPosts(page, limit, categorySlug, tag);
    const res = paginatedResponse(posts, total, page, limit);
    // 60s cache — blog list updates are infrequent (admin publishes a few
    // posts per week). CDN absorbs the bulk of traffic.
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res;
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
