import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { startImpersonation, ImpersonationError } from '@/services/impersonation';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const POST = withRole2fa('admin')(
  async (request: NextRequest, { params, user: adminUser }) => {
    try {
      const { id } = await params!;
      const targetId = Number(id);
      if (isNaN(targetId)) return errorResponse('Невалідний ID', 400);

      const result = await startImpersonation(
        adminUser!.id,
        targetId,
        getClientIp(request),
      );
      return successResponse(result);
    } catch (error) {
      if (error instanceof ImpersonationError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/users/[id]/impersonate] POST failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  },
);
