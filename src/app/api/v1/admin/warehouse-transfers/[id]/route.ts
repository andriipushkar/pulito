import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getTransfer,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  WarehouseTransferError,
} from '@/services/warehouse-transfer';
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
    const body = await request.json();

    if (body.action === 'ship') {
      const transfer = await shipTransfer(numId, user!.id);
      return successResponse(transfer);
    }
    if (body.action === 'receive') {
      const transfer = await receiveTransfer(numId, user!.id);
      return successResponse(transfer);
    }
    if (body.action === 'cancel') {
      const transfer = await cancelTransfer(numId, body.reason || '', user!.id);
      return successResponse(transfer);
    }
    return errorResponse('Невідома дія', 400);
  } catch (error) {
    if (error instanceof WarehouseTransferError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/warehouse-transfers/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
