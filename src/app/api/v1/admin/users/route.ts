import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { getAllUsers } from '@/services/user';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { filterArrayByRole } from '@/utils/role-filter';

export const GET = withRole2fa('admin', 'manager')(async (request: NextRequest, { user: adminUser }) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const roles = params.roles
      ? params.roles.split(',').map((r) => r.trim()).filter(Boolean)
      : undefined;
    const { users, total } = await getAllUsers({
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
      role: params.role || undefined,
      roles,
      wholesaleStatus: params.wholesaleStatus || undefined,
      wholesaleGroup: params.wholesaleGroup || undefined,
      isBlocked:
        params.isBlocked === 'true' ? true : params.isBlocked === 'false' ? false : undefined,
      search: params.search || undefined,
      sortBy: params.sortBy || undefined,
      sortOrder: params.sortOrder || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
    });

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const filtered = filterArrayByRole(users as Record<string, unknown>[], adminUser!.role as 'admin' | 'manager');
    return paginatedResponse(filtered, total, page, limit);
  } catch (error) {
    console.error('[Admin Users List]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
