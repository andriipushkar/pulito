import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/services/token';

// Server-Sent Events endpoint for real-time admin notifications
export async function GET(request: NextRequest) {
  // Verify admin auth via query param token (SSE can't set headers)
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return new Response('Invalid token', { status: 401 });
  }

  if (payload.role !== 'admin' && payload.role !== 'manager') {
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

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          // Check for new orders
          const newOrders = await prisma.order.count({
            where: { createdAt: { gt: lastOrderCheck } },
          });
          if (newOrders > 0) {
            const latestOrder = await prisma.order.findFirst({
              orderBy: { createdAt: 'desc' },
              select: { id: true, orderNumber: true, totalAmount: true, createdAt: true },
            });
            sendEvent('new_order', { count: newOrders, latest: latestOrder });
            lastOrderCheck = new Date();
          }

          // Check for new reviews pending moderation
          const newReviews = await prisma.review.count({
            where: { status: 'pending', createdAt: { gt: lastReviewCheck } },
          });
          if (newReviews > 0) {
            sendEvent('new_review', { count: newReviews });
            lastReviewCheck = new Date();
          }

          // Heartbeat
          sendEvent('ping', { time: new Date().toISOString() });
        } catch {
          // ignore polling errors
        }
      }, 10000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
