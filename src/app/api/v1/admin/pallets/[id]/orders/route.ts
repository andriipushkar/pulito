import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { addOrdersToPallet, removeOrderFromPallet, PalletError } from '@/services/pallet';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const addSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1).max(50),
});

// POST: attach a batch of orders to the pallet. The service refuses to add an
// order that is already on a different pallet (FK uniqueness via PalletOrder).
export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const pallet = await addOrdersToPallet(numId, parsed.data.orderIds);
    return successResponse(pallet);
  } catch (err) {
    if (err instanceof PalletError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/pallets/[id]/orders] POST failed', { error: err });
    return errorResponse('Не вдалося додати замовлення', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const palletId = Number(id);
    if (isNaN(palletId)) return errorResponse('Невалідний ID', 400);
    const orderIdRaw = request.nextUrl.searchParams.get('orderId');
    const orderId = Number(orderIdRaw);
    if (!orderIdRaw || isNaN(orderId)) return errorResponse('Очікувався ?orderId=', 400);
    const pallet = await removeOrderFromPallet(palletId, orderId);
    return successResponse(pallet);
  } catch (err) {
    if (err instanceof PalletError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/pallets/[id]/orders] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити', 500);
  }
});
