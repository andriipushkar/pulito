import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

interface ValidatePayload {
  productIds: number[];
}

export const POST = createApiHandler(RATE_LIMITS.cart, async (request: NextRequest) => {
  try {
    const body = (await request.json()) as ValidatePayload;
    const ids = Array.isArray(body.productIds)
      ? body.productIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
      : [];

    if (ids.length === 0) {
      return successResponse({ items: [] });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        quantity: true,
        isActive: true,
      },
    });

    const items = products.map((p) => ({
      productId: p.id,
      name: p.name,
      stock: p.quantity,
      isActive: p.isActive,
    }));

    return successResponse({ items });
  } catch {
    return errorResponse('Помилка перевірки кошика', 500);
  }
});
