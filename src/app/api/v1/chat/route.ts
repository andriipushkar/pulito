import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createRoom, getRoomsByUser, getUnreadCount } from '@/services/chat';
import { createRoomSchema } from '@/validators/chat';

// GET /api/v1/chat - get user's chat rooms
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const rooms = await getRoomsByUser(user.id);
    const unreadCount = await getUnreadCount(user.id);
    return successResponse({ rooms, unreadCount });
  } catch {
    return errorResponse('Не вдалося завантажити чати', 500);
  }
});

// POST /api/v1/chat - create new chat room
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 400);
    }

    const room = await createRoom(user.id, parsed.data.subject);
    return successResponse(room, 201);
  } catch {
    return errorResponse('Не вдалося створити чат', 500);
  }
});
