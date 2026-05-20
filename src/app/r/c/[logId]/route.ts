import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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
  const { logId } = await params;
  const numId = Number(logId);
  const url = request.nextUrl.searchParams.get('to') || '/';

  // Validate `to` to avoid an open-redirect: only allow same-origin paths or
  // pulito.trade hosts. Anything else falls back to homepage.
  let target = '/';
  try {
    if (url.startsWith('/')) {
      target = url;
    } else {
      const parsed = new URL(url);
      if (parsed.hostname.endsWith('pulito.trade') || parsed.hostname === 'localhost') {
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
