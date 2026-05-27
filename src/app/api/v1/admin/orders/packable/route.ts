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
    // Service already flattens warehouse info onto each item — pass through
    // stockOnHand / locationCode / locationName so the UI's stock guard and
    // location-based pick order actually work. The previous mapping dropped
    // these fields, silently disabling both features.
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
        productBarcode: i.productBarcode,
        quantity: i.quantity,
        stockOnHand: i.stockOnHand,
        locationCode: i.locationCode,
        locationName: i.locationName,
      })),
    }));
    return successResponse({ orders });
  } catch (err) {
    logger.error('[admin/orders/packable] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
