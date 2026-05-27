import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SSE stream of unread-notification count for the logged-in user.
 * Replaces the 60-second polling loop in HeaderMain — pushes a fresh count
 * every time it changes (poll-style on the server side, 5s interval; cheap).
 *
 * Format: each event is `data: {"count": N}\n\n`.
 * Stops when the client disconnects (AbortSignal).
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
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
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener('abort', abort);
    },
  });

  // NextResponse wraps a Response — the headers below are SSE-required and
  // X-Accel-Buffering disables nginx response buffering (we want stream).
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
