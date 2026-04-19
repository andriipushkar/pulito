import { NextRequest } from 'next/server';
import { withApiKey } from '@/middleware/api-key-auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { oneCOrderStatusBatchSchema } from '@/validators/integration-1c';
import { exportOrdersTo1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';
import type { OrderStatus } from '../../../../../../../generated/prisma';

const ALLOWED_STATUSES = [
  'new_order',
  'processing',
  'confirmed',
  'paid',
  'shipped',
  'completed',
  'cancelled',
  'returned',
] as const;
function toOrderStatus(value: string): OrderStatus | null {
  return (ALLOWED_STATUSES as readonly string[]).includes(value) ? (value as OrderStatus) : null;
}

/** GET /api/v1/integration/1c/orders — Export orders for 1C */
export const GET = withApiKey(['orders'])(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get('status') ?? undefined;
    const from = sp.get('from') ? new Date(sp.get('from')!) : undefined;
    const to = sp.get('to') ? new Date(sp.get('to')!) : undefined;

    const orders = await exportOrdersTo1C({ status, from, to });

    return successResponse({ orders, total: orders.length });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to export orders', 500);
  }
});

/** POST /api/v1/integration/1c/orders — Update order statuses from 1C */
export const POST = withApiKey(['orders'])(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = oneCOrderStatusBatchSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid request body';
      return errorResponse(message, 422);
    }

    const sync = await prisma.integrationSync.create({
      data: {
        type: 'one_c',
        direction: 'import_sync',
        entityType: 'order',
        status: 'running',
        itemsTotal: parsed.data.orders.length,
        startedAt: new Date(),
      },
    });

    let processed = 0;
    let failed = 0;
    const errors: Array<{ code: string; message: string }> = [];

    for (const item of parsed.data.orders) {
      try {
        const order = await prisma.order.findUnique({
          where: { orderNumber: item.orderNumber },
        });

        if (!order) {
          failed++;
          errors.push({
            code: item.orderNumber,
            message: `Order not found: ${item.orderNumber}`,
          });
          continue;
        }

        const nextStatus = toOrderStatus(item.status);
        if (!nextStatus) {
          failed++;
          errors.push({
            code: item.orderNumber,
            message: `Invalid status: ${item.status}`,
          });
          continue;
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            ...(item.trackingNumber ? { trackingNumber: item.trackingNumber } : {}),
          },
        });

        processed++;
      } catch (err) {
        failed++;
        errors.push({
          code: item.orderNumber,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    await prisma.integrationSync.update({
      where: { id: sync.id },
      data: {
        status: 'completed',
        itemsProcessed: processed,
        itemsFailed: failed,
        errorLog: errors.length > 0 ? errors : undefined,
        completedAt: new Date(),
      },
    });

    return successResponse({ total: parsed.data.orders.length, processed, failed, errors });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to update orders', 500);
  }
});
