import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import {
  checkPossibilityForRedirecting,
  createRedirectOrder,
  NovaPoshtaError,
} from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

async function loadOrderTtn(id: string): Promise<string | null> {
  const orderId = Number(id);
  if (!orderId || isNaN(orderId)) return null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { trackingNumber: true },
  });
  const ttn = order?.trackingNumber;
  return ttn && !ttn.startsWith('PENDING_') ? ttn : null;
}

// GET → whether the parcel can be redirected.
export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const ttn = await loadOrderTtn(id);
    if (!ttn) return errorResponse('У замовлення немає ТТН', 400);
    const possibility = await checkPossibilityForRedirecting(ttn);
    return successResponse({ ttn, possibility });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/redirect] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

const createSchema = z.object({
  recipientWarehouseRef: z.string().min(1, 'Вкажіть відділення призначення'),
  payerType: z.enum(['Sender', 'Recipient']).default('Recipient'),
  paymentMethod: z.enum(['Cash', 'NonCash']).default('Cash'),
  note: z.string().max(200).optional(),
});

// POST → redirect the parcel to another warehouse.
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const ttn = await loadOrderTtn(id);
    if (!ttn) return errorResponse('У замовлення немає ТТН', 400);

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const result = await createRedirectOrder({ intDocNumber: ttn, ...parsed.data });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      entityId: Number(id),
      details: { scope: 'np_redirect', ttn, redirectNumber: result.number },
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/redirect] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
