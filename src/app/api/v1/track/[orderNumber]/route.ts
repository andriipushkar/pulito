import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * Public order-tracking endpoint.
 *
 * Safe because `orderNumber` is `YYYYMMDD-<8 hex>` — ~4.3B combinations per day,
 * making sequential enumeration impractical. Combined with the strict rate limit
 * below, blind guessing is not viable. Returns only customer-facing fields
 * (status, items, tracking number, delivery info) — no payment data, no email,
 * no internal manager notes.
 */
export const GET = createApiHandler(
  RATE_LIMITS.api,
  async (
    _request: NextRequest,
    context?: { params: Promise<{ orderNumber: string }> },
  ) => {
    try {
      if (!context?.params) return errorResponse('Замовлення не знайдено', 404);
      const { orderNumber } = await context.params;

      // Defensive: orderNumber pattern is YYYYMMDD-HHHHHHHH
      if (!/^\d{8}-[0-9A-F]{8}$/i.test(orderNumber)) {
        return errorResponse('Замовлення не знайдено', 404);
      }

      const order = await prisma.order.findFirst({
        where: { orderNumber, deletedAt: null },
        select: {
          orderNumber: true,
          status: true,
          totalAmount: true,
          itemsCount: true,
          deliveryMethod: true,
          deliveryCity: true,
          deliveryAddress: true,
          trackingNumber: true,
          trackingStatus: true,
          trackingStatusAt: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              productCode: true,
              quantity: true,
              priceAtOrder: true,
              subtotal: true,
            },
          },
          statusHistory: {
            select: {
              id: true,
              newStatus: true,
              createdAt: true,
              changeSource: true,
              comment: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!order) {
        return errorResponse('Замовлення не знайдено', 404);
      }

      // Sanitize status history before returning publicly. Manager-typed
      // comments (cancellation reasons, internal notes) can include private
      // commercial details — never expose them on the public tracking page.
      // Only let through system-generated comments, which are templated and
      // safe to display (e.g. "Замовлення створено", "Оплата підтверджена").
      const PUBLIC_COMMENT_PREFIXES = [
        'Замовлення створено',
        'Оплата підтверджена',
        'Часткове повернення',
        'Повне повернення',
      ];
      const sanitized = {
        ...order,
        statusHistory: order.statusHistory.map((h) => {
          const isSystem = h.changeSource === 'system';
          const looksLikeTemplate =
            !!h.comment &&
            PUBLIC_COMMENT_PREFIXES.some((prefix) => h.comment!.startsWith(prefix));
          return {
            id: h.id,
            newStatus: h.newStatus,
            createdAt: h.createdAt,
            comment: isSystem && looksLikeTemplate ? h.comment : null,
          };
        }),
      };

      return successResponse(sanitized);
    } catch {
      return errorResponse('Помилка отримання даних замовлення', 500);
    }
  },
);
