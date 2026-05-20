import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getPackableOrders } from '@/services/order';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 200);
    const raw = await getPackableOrders(limit);
    const orders = raw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      clientType: o.clientType,
      contactName: o.contactName,
      contactPhone: o.contactPhone,
      totalAmount: String(o.totalAmount),
      trackingNumber: o.trackingNumber,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        id: i.id,
        productCode: i.productCode,
        productName: i.productName,
        productBarcode: i.product?.barcode ?? null,
        quantity: i.quantity,
      })),
    }));
    return successResponse({ orders });
  } catch (err) {
    logger.error('[admin/orders/packable] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
