import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SSE_PER_USER_CAP = 5;
const SSE_COUNTER_TTL = 600; // 10 min — auto-heals stale counts if decrement is lost

/**
 * SSE stream of unread-notification count for the logged-in user.
 * Replaces the 60-second polling loop in HeaderMain — pushes a fresh count
 * every time it changes (poll-style on the server side, 5s interval; cheap).
 *
 * Format: each event is `data: {"count": N}\n\n`.
 * Stops when the client disconnects (AbortSignal).
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  // Per-user concurrency cap — without this a user (or attacker with a valid
  // token) can open dozens of tabs, each spawning a 5s DB-count tick. Cap at
  // SSE_PER_USER_CAP concurrent streams; rely on a Redis counter that we
  // increment on connect and decrement on disconnect (with TTL fallback so a
  // crashed worker's slot eventually heals).
  const counterKey = `sse:notif:${user.id}`;
  let slotAcquired = false;
  try {
    const current = await redis.incr(counterKey);
    if (current === 1) await redis.expire(counterKey, SSE_COUNTER_TTL);
    if (current > SSE_PER_USER_CAP) {
      await redis.decr(counterKey);
      return NextResponse.json({ error: "Забагато активних з'єднань" }, { status: 429 });
    }
    slotAcquired = true;
  } catch {
    // Redis down — let the connection through (graceful degradation).
    slotAcquired = false;
  }

  const encoder = new TextEncoder();
  let lastCount = -1;

  const stream = new ReadableStream({
    async start(controller) {
      const tick = async () => {
        try {
          const count = await prisma.userNotification.count({
            where: { userId: user.id, isRead: false },
          });
          if (count !== lastCount) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ count })}\n\n`));
            lastCount = count;
          } else {
            // Heartbeat comment so proxies (Cloudflare) don't time out the connection.
            controller.enqueue(encoder.encode(`:keep-alive\n\n`));
          }
        } catch {
          // Skip this tick on transient error — connection stays open.
        }
      };

      // Initial push
      await tick();

      const interval = setInterval(tick, 5000);
      const abort = () => {
        clearInterval(interval);
        if (slotAcquired) {
          redis.decr(counterKey).catch(() => {});
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener('abort', abort);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
