import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOptionalAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const schema = z.object({
  productId: z.number().int().positive(),
  email: z.string().trim().toLowerCase().email().max(255),
});

// Uniform success message — used regardless of product existence / stock state
// so competitors can't enumerate which SKUs are OOS by probing productId.
const GENERIC_SUCCESS =
  "Якщо товар доступний для підписки, ви отримаєте сповіщення коли він з'явиться";

/**
 * POST /api/v1/products/back-in-stock
 * Subscribe to a notification when an out-of-stock product becomes available.
 * Returns a uniform 202 regardless of whether the product exists, is active,
 * or already in stock — that uniformity is intentional (anti-enumeration).
 */
export const POST = withOptionalAuth(async (request: NextRequest, { user }) => {
  const ip = getClientIp(request);
  try {
    const rl = await checkRateLimit(ip, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 422);
    }
    const { productId, email } = parsed.data;

    // Silently no-op if product doesn't exist, is inactive, or already in
    // stock — caller can't tell which case applied. Real subscriptions are
    // only created for active+OOS items.
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, quantity: true, isActive: true },
    });
    if (!product || !product.isActive || product.quantity > 0) {
      return successResponse({ message: GENERIC_SUCCESS }, 202);
    }

    await prisma.backInStockSubscription.upsert({
      where: { productId_email: { productId, email } },
      create: { productId, email, userId: user?.id ?? null },
      update: { notifiedAt: null },
    });

    await logAudit({
      userId: user?.id ?? null,
      actionType: 'data_create',
      entityType: 'back_in_stock_subscription',
      entityId: productId,
      details: { productId, hasUser: !!user },
      ipAddress: ip,
    });

    return successResponse({ message: GENERIC_SUCCESS }, 202);
  } catch (err) {
    logger.error('[back-in-stock] subscribe failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});
