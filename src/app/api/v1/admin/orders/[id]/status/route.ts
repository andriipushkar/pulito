import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateOrderStatus, OrderError } from '@/services/order';
import { updateOrderStatusSchema } from '@/validators/order';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const PUT = withRole('admin', 'manager')(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const order = await updateOrderStatus(
      numId,
      parsed.data.status,
      user.id,
      'manager',
      parsed.data.comment
    );

    await logAudit({
      userId: user.id,
      actionType: 'order_status_change',
      entityType: 'order',
      entityId: numId,
      details: { newStatus: parsed.data.status, comment: parsed.data.comment ?? null },
      ipAddress: getClientIp(request),
    });

    return successResponse(order);
  } catch (error) {
    if (error instanceof OrderError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/status] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
