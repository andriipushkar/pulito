import { NextRequest, NextResponse } from 'next/server';
import { getFeedContext, buildYmlCatalog, FEED_CACHE_MAX_AGE } from '@/services/product-feeds';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

// Epicentr marketplace imports the catalog from a YML (yml_catalog) feed by URL.
// Its merchant API is closed (Bearer-JWT, onboarding-issued) and has no public
// create-product schema, so the feed is the reliable way to publish the
// catalog. Connect this URL in the Epicentr seller cabinet (Імпорт → YML).
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
