import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

/**
 * Campaign click-through redirect. Email links wrap their final URL as
 *   /r/c/{campaignLogId}?to=https://...
 * so we can stamp `clickedAt` and bounce the user to the real target. Failure
 * to record never blocks the redirect — the worst case is a silent metric
 * gap, not a broken link.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = await checkRateLimit(ip, RATE_LIMITS.api);
  if (!rl.allowed) {
    // Drop quietly — the redirect is non-critical, no UX explanation needed.
    return new NextResponse('Rate limited', { status: 429 });
  }

  const { logId } = await params;
  const numId = Number(logId);
  const url = request.nextUrl.searchParams.get('to') || '/';

  // Validate `to` to avoid an open-redirect: only allow same-origin paths or
  // pulito.trade and its subdomains. Anything else falls back to homepage.
  let target = '/';
  try {
    if (url.startsWith('/')) {
      target = url;
    } else {
      const parsed = new URL(url);
      // Use `=== 'pulito.trade'` plus `.endsWith('.pulito.trade')` (with the
      // leading dot) — plain `endsWith('pulito.trade')` would also accept
      // `evil-pulito.trade`, turning the campaign-tracker into an
      // attacker-controlled phishing-redirect from our domain.
      const host = parsed.hostname;
      const isPulito = host === 'pulito.trade' || host.endsWith('.pulito.trade');
      const isLocalhost = host === 'localhost' && process.env.NODE_ENV !== 'production';
      if (isPulito || isLocalhost) {
        target = parsed.toString();
      }
    }
  } catch {
    target = '/';
  }

  if (Number.isFinite(numId) && numId > 0) {
    // Fire-and-forget — never delay the redirect on DB writes.
    prisma.campaignLog
      .update({
        where: { id: numId },
        data: { clickedAt: new Date() },
      })
      .catch((err) => {
        logger.warn('[campaign click] failed to record', { logId: numId, error: String(err) });
      });
  }

  return NextResponse.redirect(new URL(target, request.url), { status: 302 });
}
