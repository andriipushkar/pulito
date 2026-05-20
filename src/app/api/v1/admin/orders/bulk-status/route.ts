import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { updateOrderStatus, OrderError } from '@/services/order';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { updateOrderStatusSchema } from '@/validators/order';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const bulkStatusSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1).max(100),
  status: updateOrderStatusSchema.shape.status,
  comment: updateOrderStatusSchema.shape.comment,
});

interface BulkResult {
  ok: { orderId: number; orderNumber: string; status: string }[];
  failed: { orderId: number; orderNumber: string; error: string }[];
}

/**
 * Update status on multiple orders in one request. Each order runs through
 * updateOrderStatus independently — invalid transitions and optimistic-lock
 * conflicts on one order do not abort the rest.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = bulkStatusSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const { orderIds, status, comment } = parsed.data;

    // Look up order numbers up-front so the response is human-readable even
    // for orders that fail before updateOrderStatus runs.
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNumber: true },
    });
    const orderNumberById = new Map(orders.map((o) => [o.id, o.orderNumber]));

    const result: BulkResult = { ok: [], failed: [] };

    const ipAddress = getClientIp(request);
    for (const orderId of orderIds) {
      const orderNumber = orderNumberById.get(orderId) ?? `#${orderId}`;
      try {
        await updateOrderStatus(orderId, status, user.id, 'manager', comment);
        result.ok.push({ orderId, orderNumber, status });
        await logAudit({
          userId: user.id,
          actionType: 'order_status_change',
          entityType: 'order',
          entityId: orderId,
          details: { newStatus: status, comment: comment ?? null, bulk: true },
          ipAddress,
        });
      } catch (err) {
        const message =
          err instanceof OrderError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        if (!(err instanceof OrderError)) {
          logger.error('Bulk status update failed unexpectedly', {
            orderId,
            orderNumber,
            status,
            error: message,
          });
        }
        result.failed.push({ orderId, orderNumber, error: message });
      }
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/orders/bulk-status] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
