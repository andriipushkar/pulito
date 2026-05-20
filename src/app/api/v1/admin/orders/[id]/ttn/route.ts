import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { createTTNSchema } from '@/validators/nova-poshta';
import { createInternetDocument, NovaPoshtaError } from '@/services/nova-poshta';
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
export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
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
  }
);

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const orderId = Number(id);

      if (!orderId || isNaN(orderId)) {
        return errorResponse('Невалідний ID замовлення', 400);
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, trackingNumber: true, orderNumber: true },
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

      const result = await createInternetDocument(parsed.data);

      // Save tracking number to order
      await prisma.order.update({
        where: { id: orderId },
        data: { trackingNumber: result.intDocNumber },
      });

      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'order',
        entityId: orderId,
        details: { field: 'trackingNumber', after: result.intDocNumber, source: 'nova_poshta_api' },
      });

      void pushTrackingSafe(orderId, result.intDocNumber);

      return successResponse({
        trackingNumber: result.intDocNumber,
        ref: result.ref,
        costOnSite: result.costOnSite,
        estimatedDeliveryDate: result.estimatedDeliveryDate,
      }, 201);
    } catch (error) {
      if (error instanceof NovaPoshtaError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/orders/[id]/ttn] POST failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
