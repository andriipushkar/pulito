import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  getRoomById,
  assignAgent,
  resolveRoom,
  closeRoom,
  sendMessage,
  getMessages,
  markMessagesAsRead,
  ChatError,
} from '@/services/chat';
import { adminChatUpdateSchema, sendMessageSchema } from '@/validators/chat';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { prisma } from '@/lib/prisma';

// GET /api/v1/admin/chat/[roomId] - get room detail with messages
export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { roomId } = (await params) || {};
    const id = Number(roomId);
    if (!id) return errorResponse('Невірний ID чату', 400);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));

    const room = await getRoomById(id);
    const { messages, total } = await getMessages(id, { page, limit });

    return successResponse({ room, messages, total });
  } catch (err) {
    if (err instanceof ChatError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/chat/[roomId]] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити чат', 500);
  }
});

// PATCH /api/v1/admin/chat/[roomId] - assign/resolve/close room
export const PATCH = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user, params }) => {
  try {
    const { roomId } = (await params) || {};
    const id = Number(roomId);
    if (!id) return errorResponse('Невірний ID чату', 400);

    const body = await request.json();
    const parsed = adminChatUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 400);
    }

    const { action, agentId } = parsed.data;

    // For assign: validate that the proposed agent is actually an admin or
    // manager. Without this an admin could "assign" a customer or wholesaler
    // as the chat agent and the agent UI would silently show the wrong rows.
    if (action === 'assign' && agentId && agentId !== user.id) {
      const target = await prisma.user.findUnique({
        where: { id: agentId },
        select: { role: true, isBlocked: true, deletedAt: true },
      });
      if (!target || target.isBlocked || target.deletedAt) {
        return errorResponse('Користувача не знайдено', 404);
      }
      if (target.role !== 'admin' && target.role !== 'manager') {
        return errorResponse('Агентом може бути лише admin або manager', 400);
      }
    }

    let result;
    switch (action) {
      case 'assign':
        result = await assignAgent(id, agentId || user.id);
        // Send system message
        await sendMessage(id, 'system', null, 'Агента призначено до чату');
        break;
      case 'resolve':
        result = await resolveRoom(id);
        await sendMessage(id, 'system', null, 'Чат позначено як вирішений');
        break;
      case 'close':
        result = await closeRoom(id);
        await sendMessage(id, 'system', null, 'Чат закрито');
        break;
    }

    // Lifecycle events (assign/resolve/close) are auditable — manager-level
    // policy actions affecting customer conversations.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'chat_room',
      entityId: id,
      details: { action, agentId: agentId ?? null },
      ipAddress: getClientIp(request),
    });

    return successResponse(result);
  } catch (err) {
    if (err instanceof ChatError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/chat/[roomId]] PATCH failed', { error: err });
    return errorResponse('Помилка оновлення чату', 500);
  }
});

// POST /api/v1/admin/chat/[roomId] - send message as agent
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user, params }) => {
  try {
    // Cap agent message rate so a stuck UI button (or stolen session) can't
    // spam a customer chat. 60/min per agent covers a realistic typing pace
    // (1 msg/sec sustained) while stopping a flood.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminScan);
    if (!rl.allowed) {
      return errorResponse(`Забагато повідомлень. Зачекайте ${rl.retryAfter}с.`, 429);
    }

    const { roomId } = (await params) || {};
    const id = Number(roomId);
    if (!id) return errorResponse('Невірний ID чату', 400);

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 400);
    }

    // Mark customer messages as read when agent responds
    await markMessagesAsRead(id, user.id);

    const message = await sendMessage(
      id,
      'agent',
      user.id,
      parsed.data.content,
      parsed.data.attachmentUrl,
    );

    return successResponse(message, 201);
  } catch (err) {
    if (err instanceof ChatError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/chat/[roomId]] POST failed', { error: err });
    return errorResponse('Не вдалося відправити повідомлення', 500);
  }
});
