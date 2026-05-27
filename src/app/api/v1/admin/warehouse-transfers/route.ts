import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  createTransfer,
  listTransfers,
  WarehouseTransferError,
} from '@/services/warehouse-transfer';
import { createTransferSchema } from '@/validators/warehouse-transfer';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
    const transfers = await listTransfers({ status, offset, limit });
    return successResponse(transfers);
  } catch (error) {
    if (error instanceof WarehouseTransferError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/warehouse-transfers] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Bulk create with nested item inserts is one of the heavier admin
    // operations — adminExport (10/min per admin) is the right bucket.
    const rl = await checkRateLimit(`user:${user!.id}`, RATE_LIMITS.adminExport);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато створень переміщень. Спробуйте через ${Math.ceil(rl.retryAfter)} с.`,
        429,
      );
    }

    const body = await request.json();
    const parsed = createTransferSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const transfer = await createTransfer({
      fromWarehouseId: parsed.data.fromWarehouseId,
      toWarehouseId: parsed.data.toWarehouseId,
      items: parsed.data.items,
      comment: parsed.data.comment,
      createdBy: user!.id,
    });

    await logAudit({
      userId: user!.id,
      actionType: 'data_create',
      entityType: 'warehouse_transfer',
      entityId: transfer.id,
      details: {
        reference: transfer.reference,
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        itemCount: parsed.data.items.length,
      },
      ipAddress: getClientIp(request),
    });

    return successResponse(transfer, 201);
  } catch (error) {
    if (error instanceof WarehouseTransferError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/warehouse-transfers] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
