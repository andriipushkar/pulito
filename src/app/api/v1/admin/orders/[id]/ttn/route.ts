import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { createTTNSchema } from '@/validators/nova-poshta';
import { createInternetDocument, NovaPoshtaError } from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';

const manualTTNSchema = z.object({
  trackingNumber: z.string().min(1, 'Введіть номер ТТН').max(50),
});

// Manual TTN entry
export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const orderId = Number(id);
      if (!orderId || isNaN(orderId)) {
        return errorResponse('Невалідний ID замовлення', 400);
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true },
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

      return successResponse(updated);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
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
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
