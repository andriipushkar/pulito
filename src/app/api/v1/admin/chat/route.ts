import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { getAdminRooms } from '@/services/chat';
import { adminChatFilterSchema } from '@/validators/chat';

// GET /api/v1/admin/chat - get all chat rooms for admin
export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = adminChatFilterSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    });

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні параметри', 400);
    }

    const { page, limit, status, search } = parsed.data;
    const { rooms, total } = await getAdminRooms({ page, limit, status, search });

    return paginatedResponse(rooms, total, page, limit);
  } catch {
    return errorResponse('Не вдалося завантажити чати', 500);
  }
});
