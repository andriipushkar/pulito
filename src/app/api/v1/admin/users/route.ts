import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getAllUsers } from '@/services/user';
import { paginatedResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { users, total } = await getAllUsers({
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
      role: params.role || undefined,
      wholesaleStatus: params.wholesaleStatus || undefined,
      wholesaleGroup: params.wholesaleGroup || undefined,
      search: params.search || undefined,
      sortBy: params.sortBy || undefined,
      sortOrder: params.sortOrder || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
    });

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return paginatedResponse(users, total, page, limit);
  } catch (error) {
    console.error('[Admin Users List]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
