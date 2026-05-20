import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getStockCount,
  completeStockCount,
  cancelStockCount,
  StockCountError,
} from '@/services/stock-count';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const count = await getStockCount(Number(id));
    return successResponse(count);
  } catch (error) {
    if (error instanceof StockCountError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/stock-counts/[id]] GET failed', { error });
    return errorResponse('Помилка сервера', 500);
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
    if (body.action === 'complete') {
      const c = await completeStockCount(numId, user!.id);
      return successResponse(c);
    }
    if (body.action === 'cancel') {
      const c = await cancelStockCount(numId, user!.id);
      return successResponse(c);
    }
    return errorResponse('Невідома дія', 400);
  } catch (error) {
    if (error instanceof StockCountError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/stock-counts/[id]] PUT failed', { error });
    return errorResponse('Помилка сервера', 500);
  }
});
