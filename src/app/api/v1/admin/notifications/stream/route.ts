import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySseGrantToken } from '@/services/token';
import { getSseGrantFromCookies } from '@/utils/cookies';

// Server-Sent Events endpoint for real-time admin notifications.
//
// Auth model: read a short-lived HttpOnly cookie (`admin_sse_grant`) that's
// issued by POST /api/v1/admin/sse-grant — itself behind withRole2fa('admin').
// The cookie keeps the token off URLs (no referer/log/history leak) and the
// grant endpoint enforces admin+2FA — neither query-string tokens nor a
// manager role can reach the stream anymore.
export async function GET(request: NextRequest) {
  const grant = getSseGrantFromCookies(request.headers.get('cookie'));
  if (!grant) {
    return new Response('Unauthorized', { status: 401 });
  }
  let payload;
  try {
    payload = verifySseGrantToken(grant);
  } catch {
    return new Response('Invalid grant', { status: 401 });
  }
  if (payload.scope !== 'admin_notifications' || payload.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial ping
      sendEvent('ping', { time: new Date().toISOString() });

      // Poll for new data every 10 seconds
      let lastOrderCheck = new Date();
      let lastReviewCheck = new Date();
      let polling = false;

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        // Skip if previous poll is still running (DB hiccup must not pile up
        // overlapping queries that all race to advance lastOrderCheck).
        if (polling) return;
        polling = true;

        try {
          // Capture the cutoff BEFORE the query — otherwise rows inserted
          // between query and assignment are silently dropped on next tick.
          const orderCheckAt = new Date();
          const newOrders = await prisma.order.count({
            where: { createdAt: { gt: lastOrderCheck } },
          });
          if (newOrders > 0) {
            const latestOrder = await prisma.order.findFirst({
              orderBy: { createdAt: 'desc' },
              select: { id: true, orderNumber: true, totalAmount: true, createdAt: true },
            });
            sendEvent('new_order', { count: newOrders, latest: latestOrder });
          }
          lastOrderCheck = orderCheckAt;

          const reviewCheckAt = new Date();
          const newReviews = await prisma.review.count({
            where: { status: 'pending', createdAt: { gt: lastReviewCheck } },
          });
          if (newReviews > 0) {
            sendEvent('new_review', { count: newReviews });
          }
          lastReviewCheck = reviewCheckAt;

          // Heartbeat
          sendEvent('ping', { time: new Date().toISOString() });
        } catch {
          // ignore polling errors
        } finally {
          polling = false;
        }
      }, 10000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
