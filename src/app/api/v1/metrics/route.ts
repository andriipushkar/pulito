import { NextRequest } from 'next/server';
import { recordMetric } from '@/services/performance';

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
