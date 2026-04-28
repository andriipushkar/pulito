import { NextRequest } from 'next/server';
import { recordMetric } from '@/services/performance';
import { recordClientEvent } from '@/services/client-events';

// 1x1 transparent GIF used as the email-open tracking pixel
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const TRACKING_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

const VALID_METRICS = ['LCP', 'CLS', 'FID', 'TTFB', 'INP', 'FCP'];
const ROUTE_PATTERN = /^\/[a-zA-Z0-9\-\/\[\]_]*$/;
const MAX_ROUTE_LENGTH = 256;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { route: rawRoute, metric, value } = body;

    if (!rawRoute || !metric || typeof value !== 'number') {
      return new Response(null, { status: 400 });
    }

    if (!VALID_METRICS.includes(metric)) {
      return new Response(null, { status: 400 });
    }

    // Sanitize and validate route string
    const route = String(rawRoute).slice(0, MAX_ROUTE_LENGTH);
    if (!ROUTE_PATTERN.test(route)) {
      return new Response(null, { status: 400 });
    }

    // Validate value range (Web Vitals are positive numbers)
    if (value < 0 || value > 60000 || !isFinite(value)) {
      return new Response(null, { status: 400 });
    }

    // Fire and forget — don't block
    recordMetric({ route, metric, value }).catch(() => {});

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}

/**
 * GET /api/v1/metrics?type=email_open&id={trackingId}
 *
 * Returns a 1x1 transparent GIF and asynchronously records an `email_open`
 * ClientEvent. Used as a tracking pixel inside transactional emails.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get('type');
  const id = params.get('id');

  if (type === 'email_open' && id && TRACKING_ID_PATTERN.test(id)) {
    recordClientEvent({
      eventType: 'email_open',
      metadata: { trackingId: id },
    }).catch(() => {});
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
