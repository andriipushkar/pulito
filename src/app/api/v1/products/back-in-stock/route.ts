import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOptionalAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const schema = z.object({
  productId: z.number().int().positive(),
  email: z.string().email().max(255),
});

/**
 * POST /api/v1/products/back-in-stock
 * Subscribe to a notification when an out-of-stock product becomes available.
 * Idempotent: same (productId, email) returns the existing row.
 */
export const POST = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 422);
    }
    const { productId, email } = parsed.data;

    // Ignore if product is already in stock — no need to subscribe
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, quantity: true, isActive: true },
    });
    if (!product || !product.isActive) return errorResponse('Товар не знайдено', 404);
    if (product.quantity > 0) {
      return errorResponse('Товар уже в наявності', 400);
    }

    const sub = await prisma.backInStockSubscription.upsert({
      where: { productId_email: { productId, email: email.toLowerCase() } },
      create: {
        productId,
        email: email.toLowerCase(),
        userId: user?.id ?? null,
      },
      update: {
        // Re-subscribing resets the notification flag so user gets notified again next time
        notifiedAt: null,
      },
    });

    return successResponse({ id: sub.id, subscribed: true });
  } catch (err) {
    logger.error('[back-in-stock] subscribe failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});
