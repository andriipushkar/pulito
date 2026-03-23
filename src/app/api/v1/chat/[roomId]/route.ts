import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getRoomById, sendMessage, getMessages } from '@/services/chat';
import { sendMessageSchema } from '@/validators/chat';
import { ChatError } from '@/services/chat';

// GET /api/v1/chat/[roomId] - get messages for a room
export const GET = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { roomId } = (await params) || {};
    const id = Number(roomId);
    if (!id) return errorResponse('Невірний ID чату', 400);

    const room = await getRoomById(id);

    // Ensure user owns this room
    if (room.userId !== user.id) {
      return errorResponse('Доступ заборонено', 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));

    const { messages, total } = await getMessages(id, { page, limit });

    return successResponse({
      room: {
        id: room.id,
        status: room.status,
        subject: room.subject,
        assignedAgent: room.assignedAgent,
        createdAt: room.createdAt,
      },
      messages,
      total,
    });
  } catch (err) {
    if (err instanceof ChatError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Не вдалося завантажити повідомлення', 500);
  }
});

// POST /api/v1/chat/[roomId] - send a message
export const POST = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { roomId } = (await params) || {};
    const id = Number(roomId);
    if (!id) return errorResponse('Невірний ID чату', 400);

    // Verify the room exists and user owns it
    const room = await getRoomById(id);
    if (room.userId !== user.id) {
      return errorResponse('Доступ заборонено', 403);
    }

    if (room.status === 'closed') {
      return errorResponse('Чат закрито', 400);
    }

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || 'Невірні дані', 400);
    }

    const message = await sendMessage(
      id,
      'customer',
      user.id,
      parsed.data.content,
      parsed.data.attachmentUrl
    );

    return successResponse(message, 201);
  } catch (err) {
    if (err instanceof ChatError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Не вдалося відправити повідомлення', 500);
  }
});
