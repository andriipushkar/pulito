import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { reorderFromOrder, ReorderError } from '@/services/reorder';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { orderId } = await params!;
    const id = Number(orderId);
    // `isNaN(-5) === false` — guard with positive-integer check.
    if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    const result = await reorderFromOrder(id, user.id);

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'reorder',
      entityId: id,
      details: { sourceOrderId: id },
      ipAddress: getClientIp(request),
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof ReorderError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка повторного замовлення', 500);
  }
});
