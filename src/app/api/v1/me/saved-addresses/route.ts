import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getCheckoutConfig } from '@/services/checkout-config';

interface SavedAddress {
  deliveryMethod: string;
  city: string;
  address: string;
  warehouseRef: string | null;
  usedAt: string;
}

/**
 * Returns up to 5 unique recent shipping addresses from user's orders.
 * Filtered by currently-available delivery methods (admin may have disabled
 * a carrier since the order was placed, in which case the preset would lead
 * to a broken checkout).
 */
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const [orders, config] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id, deliveryCity: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          deliveryMethod: true,
          deliveryCity: true,
          deliveryAddress: true,
          deliveryWarehouseRef: true,
          createdAt: true,
        },
      }),
      getCheckoutConfig(),
    ]);

    const isAvailable = (method: string): boolean => {
      const a = config.delivery.available;
      return method in a && a[method as keyof typeof a] === true;
    };

    const seen = new Set<string>();
    const unique: SavedAddress[] = [];
    for (const o of orders) {
      if (!isAvailable(o.deliveryMethod)) continue;
      const key = `${o.deliveryMethod}|${o.deliveryCity}|${o.deliveryAddress}|${o.deliveryWarehouseRef ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({
        deliveryMethod: o.deliveryMethod,
        city: o.deliveryCity ?? '',
        address: o.deliveryAddress ?? '',
        warehouseRef: o.deliveryWarehouseRef ?? null,
        usedAt: o.createdAt.toISOString(),
      });
      if (unique.length >= 5) break;
    }

    return successResponse(unique);
  } catch {
    return errorResponse('Помилка завантаження адрес', 500);
  }
});
