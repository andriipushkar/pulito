import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  createTransfer,
  listTransfers,
  WarehouseTransferError,
} from '@/services/warehouse-transfer';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

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
    const body = await request.json();
    const fromWarehouseId = Number(body.fromWarehouseId);
    const toWarehouseId = Number(body.toWarehouseId);
    if (!Number.isInteger(fromWarehouseId) || fromWarehouseId <= 0) {
      return errorResponse('Невалідний fromWarehouseId', 400);
    }
    if (!Number.isInteger(toWarehouseId) || toWarehouseId <= 0) {
      return errorResponse('Невалідний toWarehouseId', 400);
    }
    if (fromWarehouseId === toWarehouseId) {
      return errorResponse('Склад відправлення та одержання не може бути однаковим', 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('items є обовʼязковим непорожнім масивом', 400);
    }
    const items: { productId: number; quantity: number }[] = [];
    for (const raw of body.items) {
      const productId = Number(raw?.productId);
      const quantity = Number(raw?.quantity);
      if (!Number.isInteger(productId) || productId <= 0) {
        return errorResponse('Невалідний productId у items', 400);
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return errorResponse('quantity у items має бути більше нуля', 400);
      }
      items.push({ productId, quantity });
    }
    const transfer = await createTransfer({
      fromWarehouseId,
      toWarehouseId,
      items,
      comment: body.comment || undefined,
      createdBy: user!.id,
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
