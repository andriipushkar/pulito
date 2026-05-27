import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Public — capped per-IP plus a 60s CDN cache header. The homepage
    // ISR already caches the rendered page, but direct API hits (the JSON
    // payload) were uncapped and uncached, so a bot scraping banners
    // hit Postgres on every request.
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.api);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageDesktop: true,
        imageMobile: true,
        buttonText: true,
        buttonLink: true,
      },
    });
    const res = successResponse(banners);
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res;
  } catch {
    return errorResponse('Помилка завантаження банерів', 500);
  }
}
