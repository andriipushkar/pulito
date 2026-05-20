import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { rollbackImport, ImportError } from '@/services/import';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const POST = withRole(
  'admin', // rollback is destructive — admin only, not manager
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const result = await rollbackImport(numId, user.id);

    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'import_log',
      entityId: numId,
      details: { ...result, action: 'rollback' },
      ipAddress: getClientIp(request),
    });

    return successResponse(result);
  } catch (err) {
    if (err instanceof ImportError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/import/logs/[id]/rollback] POST failed', { error: err });
    return errorResponse('Не вдалося скасувати імпорт', 500);
  }
});
