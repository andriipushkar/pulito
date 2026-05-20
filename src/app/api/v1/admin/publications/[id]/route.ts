import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updatePublication, deletePublication, PublicationError } from '@/services/publication';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();
      const pub = await updatePublication(numId, body);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'publication',
        entityId: numId,
      });
      return successResponse(pub);
    } catch (error) {
      if (error instanceof PublicationError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/publications/[id]] PUT failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      await deletePublication(numId);
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'publication',
        entityId: numId,
      });
      return successResponse({ deleted: true });
    } catch (error) {
      if (error instanceof PublicationError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/publications/[id]] DELETE failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
