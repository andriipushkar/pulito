import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getStockCount,
  completeStockCount,
  cancelStockCount,
  StockCountError,
} from '@/services/stock-count';
import { stockCountActionSchema } from '@/validators/stock-count';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    // Match the PUT handler: reject non-positive-integer ids instead of letting
    // Number("abc")=NaN flow into Prisma.
    if (!Number.isInteger(numId) || numId <= 0) {
      return errorResponse('Невалідний ID', 400);
    }
    const count = await getStockCount(numId);
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
    if (!Number.isInteger(numId) || numId <= 0) {
      return errorResponse('Невалідний ID', 400);
    }
    const body = await request.json();
    const parsed = stockCountActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    if (parsed.data.action === 'complete') {
      const c = await completeStockCount(numId, user!.id);
      return successResponse(c);
    }
    const c = await cancelStockCount(numId, user!.id);
    return successResponse(c);
  } catch (error) {
    if (error instanceof StockCountError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/stock-counts/[id]] PUT failed', { error });
    return errorResponse('Помилка сервера', 500);
  }
});
