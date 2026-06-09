import { NextRequest, NextResponse } from 'next/server';
import { getFeedContext, buildYmlCatalog, FEED_CACHE_MAX_AGE } from '@/services/product-feeds';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

// Prom.ua imports the catalog from a YML (yml_catalog) feed by URL — it has no
// product-creation API. Connect this URL in the Prom cabinet (Імпорт → за
// посиланням, формат YML). The API is then used only to sync price/stock of
// products that already exist on Prom. Spec: support.prom.ua "Імпорт через YML".
export const dynamic = 'force-dynamic';
export const revalidate = 1800;

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicFeed);
  if (!rl.allowed) {
    return new NextResponse('Rate limit exceeded', { status: 429 });
  }

  const ctx = await getFeedContext();
  return new NextResponse(buildYmlCatalog(ctx), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${FEED_CACHE_MAX_AGE}, s-maxage=${FEED_CACHE_MAX_AGE}`,
    },
  });
}
