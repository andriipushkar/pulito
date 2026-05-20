import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { duplicateProduct, ProductError } from '@/services/product';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const duplicated = await duplicateProduct(numId);

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'product',
      entityId: duplicated.id,
      details: { duplicatedFrom: numId, code: duplicated.code },
      ipAddress: getClientIp(request),
    });

    return successResponse(duplicated, 201);
  } catch (err) {
    if (err instanceof ProductError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/products/[id]/duplicate] POST failed', { error: err });
    return errorResponse('Не вдалося дублювати товар', 500);
  }
});
