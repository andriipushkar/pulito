import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { createTTNSchema } from '@/validators/nova-poshta';
import {
  createInternetDocument,
  deleteInternetDocument,
  NovaPoshtaError,
} from '@/services/nova-poshta';
import { pushTrackingSafe } from '@/services/marketplace-tracking';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// Nova Poshta TTN is always 14 digits (the marketplace tracking push also
// expects exactly this format). Enforce server-side so non-frontend callers
// — bulk-TTN scripts, integrations — can't sneak in "abc" and ship that to
// the marketplace channel.
const manualTTNSchema = z.object({
  trackingNumber: z
    .string()
    .trim()
    .regex(/^\d{14}$/, 'ТТН має містити рівно 14 цифр (номер Нової Пошти)'),
});

// Manual TTN entry
export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, trackingNumber: true },
    });
    if (!order) {
      return errorResponse('Замовлення не знайдено', 404);
    }

    const body = await request.json();
    const parsed = manualTTNSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { trackingNumber: parsed.data.trackingNumber },
      select: { id: true, trackingNumber: true },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      entityId: orderId,
      details: {
        field: 'trackingNumber',
        before: order.trackingNumber,
        after: parsed.data.trackingNumber,
        source: 'manual',
      },
    });

    // Fire-and-forget: notify the marketplace (if this order came from one).
    void pushTrackingSafe(orderId, parsed.data.trackingNumber);

    return successResponse(updated);
  } catch (err) {
    logger.error('[admin/orders/[id]/ttn] PUT failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);

    if (!orderId || isNaN(orderId)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        orderNumber: true,
        // Derive COD + delivery-type server-side from the order so the form
        // can't create a TTN that collects no money (COD) or has no address.
        paymentMethod: true,
        paymentStatus: true,
        totalAmount: true,
        deliveryWarehouseRef: true,
        deliveryStreetRef: true,
        deliveryBuilding: true,
        deliveryFlat: true,
      },
    });

    if (!order) {
      return errorResponse('Замовлення не знайдено', 404);
    }

    if (order.trackingNumber) {
      return errorResponse(`ТТН вже створено: ${order.trackingNumber}`, 400);
    }

    const body = await request.json();
    const parsed = createTTNSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    // Atomic claim BEFORE the external API call. We use a sentinel value
    // (`PENDING_<orderId>`) so a concurrent request sees a non-null
    // trackingNumber and bails. If the NP call fails we roll back.
    // Previously two parallel clicks both passed `if (order.trackingNumber)`
    // (saw the same null read) and BOTH hit NP — duplicate TTNs, double
    // billed by NP.
    const sentinel = `PENDING_${orderId}_${Date.now()}`;
    const claim = await prisma.order.updateMany({
      where: { id: orderId, trackingNumber: null },
      data: { trackingNumber: sentinel },
    });
    if (claim.count === 0) {
      // Re-read to give the user a useful message — could be a concurrent
      // create that already finished, or another PENDING sentinel.
      const fresh = await prisma.order.findUnique({
        where: { id: orderId },
        select: { trackingNumber: true },
      });
      const currentTtn = fresh?.trackingNumber || '';
      if (currentTtn.startsWith('PENDING_')) {
        return errorResponse('Створення ТТН уже виконується для цього замовлення', 409);
      }
      return errorResponse(`ТТН вже створено: ${currentTtn}`, 409);
    }

    // Server-authoritative COD + delivery-type. The manual form historically
    // sent neither codAmount nor street/house, so COD orders got a TTN that
    // collected nothing and door-delivery orders got an invalid address. We
    // derive both from the order itself (mirrors the auto-TTN path in
    // order.ts) so the form's values can't cause money loss or a rejected TTN.
    const isCOD = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid';
    const isD2D = !!order.deliveryStreetRef && !!order.deliveryBuilding;
    const ttnInput = {
      ...parsed.data,
      codAmount: isCOD ? Number(order.totalAmount) : undefined,
      ...(isD2D
        ? {
            serviceType: 'WarehouseDoors' as const,
            recipientStreetRef: order.deliveryStreetRef ?? undefined,
            recipientBuilding: order.deliveryBuilding ?? undefined,
            recipientFlat: order.deliveryFlat ?? undefined,
            recipientWarehouseRef: undefined,
          }
        : {
            // No structured address captured → warehouse pickup. Force it so a
            // mis-selected "Doors" option can't produce an addressless TTN.
            serviceType: 'WarehouseWarehouse' as const,
            recipientWarehouseRef:
              parsed.data.recipientWarehouseRef || order.deliveryWarehouseRef || undefined,
            recipientStreetRef: undefined,
            recipientBuilding: undefined,
            recipientFlat: undefined,
          }),
    };

    let result;
    try {
      result = await createInternetDocument(ttnInput);
    } catch (err) {
      // External call failed — release the sentinel so a retry can claim.
      await prisma.order.updateMany({
        where: { id: orderId, trackingNumber: sentinel },
        data: { trackingNumber: null },
      });
      throw err;
    }

    // Save tracking number + Ref to order — only overwrite our own sentinel so
    // a concurrent admin tool change (rare) doesn't get clobbered. The Ref is
    // required later for cancel (delete) and ScanSheet (реєстр) operations.
    await prisma.order.updateMany({
      where: { id: orderId, trackingNumber: sentinel },
      data: { trackingNumber: result.intDocNumber, trackingRef: result.ref },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      entityId: orderId,
      details: { field: 'trackingNumber', after: result.intDocNumber, source: 'nova_poshta_api' },
    });

    void pushTrackingSafe(orderId, result.intDocNumber);

    return successResponse(
      {
        trackingNumber: result.intDocNumber,
        ref: result.ref,
        costOnSite: result.costOnSite,
        estimatedDeliveryDate: result.estimatedDeliveryDate,
      },
      201,
    );
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/ttn] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

// Cancel (delete) a TTN created via the NP API. Requires the stored Ref —
// manually-entered numbers have none and can only be cleared, not cancelled
// at NP. Clears the tracking fields on success so a new TTN can be created.
export const DELETE = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, trackingNumber: true, trackingRef: true },
    });
    if (!order) {
      return errorResponse('Замовлення не знайдено', 404);
    }
    if (!order.trackingNumber) {
      return errorResponse('У замовлення немає ТТН', 400);
    }
    if (!order.trackingRef) {
      return errorResponse(
        'ТТН введено вручну (немає Ref) — скасуйте його в кабінеті Нової Пошти, потім очистіть номер',
        400,
      );
    }

    await deleteInternetDocument(order.trackingRef);

    await prisma.order.update({
      where: { id: orderId },
      data: { trackingNumber: null, trackingRef: null },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      entityId: orderId,
      details: {
        field: 'trackingNumber',
        before: order.trackingNumber,
        after: null,
        source: 'nova_poshta_cancel',
      },
    });

    return successResponse({ cancelled: true });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/ttn] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
