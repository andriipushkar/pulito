import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { getAllUsers } from '@/services/user';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { filterArrayByRole } from '@/utils/role-filter';
import { maskEmail, maskPhone } from '@/utils/pii';

// Hard cap per page. Prevents `?limit=999999` from being a one-shot dump
// of the entire user table — `getAllUsers` would honour any number we
// passed through. 100 still lets the admin's CSV-style export work.
const MAX_LIMIT = 100;

export const GET = withRole2fa(
  'admin',
  'manager',
)(async (request: NextRequest, { user: adminUser }) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const roles = params.roles
      ? params.roles
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit) || 20));
    const { users, total } = await getAllUsers({
      page,
      limit,
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

    const role = adminUser!.role as 'admin' | 'manager';
    let filtered = filterArrayByRole(users as Record<string, unknown>[], role);

    // Manager-role gets contact-mask treatment. They legitimately need to
    // SEE who's in the system to dispatch orders, but full email+phone +
    // EDRPOU is unnecessary for the list view (they open the detail page
    // when actually contacting). Limits the blast radius of a hijacked
    // manager session — bulk PII export becomes useless.
    if (role !== 'admin') {
      filtered = filtered.map((u) => ({
        ...u,
        email: maskEmail(typeof u.email === 'string' ? u.email : null) ?? u.email,
        phone: maskPhone(typeof u.phone === 'string' ? u.phone : null) ?? u.phone,
        edrpou: u.edrpou ? '••••••••' : u.edrpou,
      }));
    }

    return paginatedResponse(filtered, total, page, limit);
  } catch (error) {
    console.error('[Admin Users List]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
