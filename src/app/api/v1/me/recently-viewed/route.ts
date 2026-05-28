import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import {
  getRecentlyViewed,
  addRecentlyViewed,
  clearRecentlyViewed,
} from '@/services/recently-viewed';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

const addSchema = z.object({
  productId: z.number().int().positive(),
});

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.api);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const raw = Number(request.nextUrl.searchParams.get('limit'));
    // Reject NaN / negatives / fractions — Prisma `take: -50` would happily
    // execute a reversed query, and `take: 0.5` throws at runtime.
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 30) : 15;
    const items = await getRecentlyViewed(user.id, limit);
    return successResponse(items);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Product existence check — otherwise the FK insert silently fails (or
    // the row points at a deleted/draft product, polluting future GETs).
    const exists = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true },
    });
    if (!exists) return errorResponse('Продукт не знайдено', 404);

    await addRecentlyViewed(user.id, parsed.data.productId);
    return successResponse({ message: 'ok' });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    await clearRecentlyViewed(user.id);
    return successResponse({ message: 'Історію очищено' });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
