import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  recordClientEvent,
  recordClientEventsBatch,
  isValidEventType,
} from '@/services/client-events';

interface IncomingEvent {
  eventType?: unknown;
  sessionId?: unknown;
  productId?: unknown;
  orderId?: unknown;
  metadata?: unknown;
}

function parseSingleEvent(payload: IncomingEvent, userId: number | null) {
  if (!isValidEventType(payload.eventType)) return null;

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.slice(0, 64) : null;
  const productId =
    typeof payload.productId === 'number' && Number.isInteger(payload.productId)
      ? payload.productId
      : null;
  const orderId =
    typeof payload.orderId === 'number' && Number.isInteger(payload.orderId)
      ? payload.orderId
      : null;
  const metadata =
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? (payload.metadata as Record<string, unknown>)
      : null;

  return {
    eventType: payload.eventType as string,
    userId,
    sessionId,
    productId,
    orderId,
    metadata,
  };
}

export const POST = withOptionalAuth(async (request: NextRequest, { user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Невалідний JSON', 400);
  }

  const userId = user?.id ?? null;

  if (Array.isArray(body)) {
    if (body.length === 0) return successResponse({ recorded: 0 });
    if (body.length > 50) return errorResponse('Забагато подій у пакеті (макс. 50)', 400);

    const parsed = body
      .map((e) => parseSingleEvent(e as IncomingEvent, userId))
      .filter((e): e is NonNullable<ReturnType<typeof parseSingleEvent>> => e !== null);

    const recorded = await recordClientEventsBatch(parsed);
    return successResponse({ recorded });
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Невалідний формат запиту', 400);
  }

  const parsed = parseSingleEvent(body as IncomingEvent, userId);
  if (!parsed) {
    return errorResponse('Невалідний eventType', 400);
  }

  await recordClientEvent(parsed);
  return successResponse({ recorded: 1 }, 201);
});
