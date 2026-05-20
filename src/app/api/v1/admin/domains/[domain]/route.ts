import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { removeDomain } from '@/services/domain';
import { resolveActiveTenantId } from '@/lib/admin-tenant';
import { logger } from '@/lib/logger';

export const DELETE = withRole2fa('admin')(
  async (
    request: NextRequest,
    { user }
  ) => {
    try {
      const resolved = await resolveActiveTenantId(request, user.id);
      if ('error' in resolved) return resolved.error;

      await removeDomain(resolved.tenantId);
      return successResponse({ removed: true });
    } catch (err) {
      logger.error('[admin/domains DELETE] failed', { error: err });
      return errorResponse('Помилка видалення домену', 500);
    }
  }
);
