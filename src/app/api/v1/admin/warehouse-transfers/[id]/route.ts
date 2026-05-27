import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getTransfer,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  cancelInTransitTransfer,
  WarehouseTransferError,
} from '@/services/warehouse-transfer';
import { transferActionSchema } from '@/validators/warehouse-transfer';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const transfer = await getTransfer(Number(id));
    return successResponse(transfer);
  } catch (error) {
    if (error instanceof WarehouseTransferError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/warehouse-transfers/[id]] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return errorResponse('Невалідний ID', 400);
    }
    const body = await request.json();
    const parsed = transferActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    switch (parsed.data.action) {
      case 'ship': {
        const transfer = await shipTransfer(numId, user!.id);
        return successResponse(transfer);
      }
      case 'receive': {
        const transfer = await receiveTransfer(numId, user!.id);
        return successResponse(transfer);
      }
      case 'cancel': {
        const transfer = await cancelTransfer(numId, parsed.data.reason || '', user!.id);
        return successResponse(transfer);
      }
      case 'cancel-in-transit': {
        const transfer = await cancelInTransitTransfer(numId, parsed.data.reason || '', user!.id);
        return successResponse(transfer);
      }
    }
  } catch (error) {
    if (error instanceof WarehouseTransferError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/warehouse-transfers/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
