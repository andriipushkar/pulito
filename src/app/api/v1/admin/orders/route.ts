import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getAllOrders, getOrderStats } from '@/services/order';
import { orderFilterSchema } from '@/validators/order';
import { errorResponse, paginatedResponse, successResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);

    // Stats endpoint
    if (params.stats === 'true') {
      const stats = await getOrderStats();
      return successResponse(stats);
    }

    const parsed = orderFilterSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { orders, total } = await getAllOrders(parsed.data);
    return paginatedResponse(orders, total, parsed.data.page, parsed.data.limit);
  } catch (err) {
    logger.error('[admin/orders] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
