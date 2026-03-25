import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/services/token';

const POLL_INTERVAL_MS = 3000;

/**
 * Server-Sent Events endpoint for real-time chat messages.
 * Polls the database for new messages and streams them to the client.
 *
 * Usage: GET /api/v1/chat/{roomId}/stream?token=<jwt>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId: roomIdStr } = await params;
  const roomId = Number(roomIdStr);
  if (!roomId) {
    return new Response('Invalid room ID', { status: 400 });
  }

  // Verify auth via query param token (SSE can't set headers)
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

  // Verify user has access to this room
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { userId: true, assignedAgentId: true },
  });

  if (!room) {
    return new Response('Room not found', { status: 404 });
  }

  const isAdmin = payload.role === 'admin' || payload.role === 'manager';
  const isRoomParticipant = room.userId === payload.sub || room.assignedAgentId === payload.sub;
  if (!isAdmin && !isRoomParticipant) {
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

      // Send initial ping with room info
      sendEvent('connected', { roomId, time: new Date().toISOString() });

      let lastCheck = new Date();

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          // Check for new messages since last check
          const newMessages = await prisma.chatMessage.findMany({
            where: {
              roomId,
              createdAt: { gt: lastCheck },
            },
            orderBy: { createdAt: 'asc' },
          });

          for (const msg of newMessages) {
            sendEvent('message', msg);
          }

          if (newMessages.length > 0) {
            lastCheck = newMessages[newMessages.length - 1].createdAt;
          }

          // Check for room status changes
          const currentRoom = await prisma.chatRoom.findUnique({
            where: { id: roomId },
            select: { status: true, assignedAgentId: true },
          });

          if (currentRoom) {
            sendEvent('ping', {
              time: new Date().toISOString(),
              roomStatus: currentRoom.status,
            });
          }
        } catch {
          // ignore polling errors
        }
      }, POLL_INTERVAL_MS);

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
