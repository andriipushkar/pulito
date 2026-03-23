import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { markMessagesAsRead, getRoomById, ChatError } from '@/services/chat';

// POST /api/v1/chat/[roomId]/read - mark messages as read
export const POST = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { roomId } = (await params) || {};
    const id = Number(roomId);
    if (!id) return errorResponse('Невірний ID чату', 400);

    // Verify the room exists and user owns it
    const room = await getRoomById(id);
    if (room.userId !== user.id) {
      return errorResponse('Доступ заборонено', 403);
    }

    const result = await markMessagesAsRead(id, user.id);
    return successResponse({ updated: result.count });
  } catch (err) {
    if (err instanceof ChatError) {
      return errorResponse(err.message, err.statusCode);
    }
    return errorResponse('Помилка', 500);
  }
});
