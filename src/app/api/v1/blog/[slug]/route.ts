import { NextRequest } from 'next/server';
import { getPostBySlug, getRelatedPosts } from '@/services/blog';
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
    const post = await getPostBySlug(slug);

    if (!post) {
      return errorResponse('Статтю не знайдено', 404);
    }

    const related = await getRelatedPosts(post.id);

    // 5 min cache — published article content rarely changes; CDN absorbs
    // direct API hits from server-side rendering and any external bots.
    const res = successResponse({ ...post, related });
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res;
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
