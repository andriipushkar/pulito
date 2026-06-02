import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import {
  getReturnReasons,
  getReturnReasonsSubtypes,
  checkPossibilityCreateReturn,
  createReturnOrder,
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

// GET → return reasons + whether a return is possible for this order's TTN.
export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const ttn = await loadOrderTtn(id);
    if (!ttn) return errorResponse('У замовлення немає ТТН', 400);

    // Second step of the form: subtypes for a chosen reason.
    const reasonRef = request.nextUrl.searchParams.get('reasonRef');
    if (reasonRef) {
      return successResponse({ subtypes: await getReturnReasonsSubtypes(reasonRef) });
    }

    const [reasons, possibility] = await Promise.all([
      getReturnReasons(),
      checkPossibilityCreateReturn(ttn).catch(() => null),
    ]);
    return successResponse({ ttn, reasons, possibility });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/return] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

const createSchema = z.object({
  reasonRef: z.string().min(1, 'Вкажіть причину повернення'),
  subtypeReasonRef: z.string().min(1, 'Вкажіть підтип причини'),
  returnAddressRef: z.string().min(1, 'Вкажіть адресу повернення'),
  paymentMethod: z.enum(['Cash', 'NonCash']).default('Cash'),
});

// POST → create a return order back to our address/warehouse.
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

    const result = await createReturnOrder({ intDocNumber: ttn, ...parsed.data });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      entityId: Number(id),
      details: { scope: 'np_return', ttn, returnNumber: result.number },
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/return] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
