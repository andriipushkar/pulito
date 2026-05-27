import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { startStockCount, listStockCounts, StockCountError } from '@/services/stock-count';
import { startStockCountSchema } from '@/validators/stock-count';
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
    const counts = await listStockCounts({ status, offset, limit });
    return successResponse(counts);
  } catch (err) {
    logger.error('[admin/stock-counts] GET failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = startStockCountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const count = await startStockCount(parsed.data.warehouseId, user!.id, parsed.data.comment);
    return successResponse(count, 201);
  } catch (error) {
    if (error instanceof StockCountError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/stock-counts] POST failed', { error });
    return errorResponse('Помилка сервера', 500);
  }
});
