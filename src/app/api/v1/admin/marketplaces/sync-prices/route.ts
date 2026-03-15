import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { syncMarketplacePrices } from '@/services/marketplaces';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const { channel } = await request.json();

      if (!channel) return errorResponse('channel обов\'язковий', 400);

      // Find all published listings for this channel
      const publications = await prisma.publicationChannel.findMany({
        where: { channel, status: 'published', externalId: { not: null } },
        include: {
          publication: {
            select: {
              productId: true,
              product: { select: { priceRetail: true, quantity: true } },
            },
          },
        },
      });

      const listings = publications
        .filter((p) => p.externalId && p.publication.productId && p.publication.product)
        .map((p) => ({
          externalId: p.externalId!,
          price: Number(p.publication.product!.priceRetail),
          quantity: p.publication.product!.quantity,
        }));

      if (listings.length === 0) {
        return successResponse({ updated: 0, failed: 0, message: 'Немає опублікованих товарів для синхронізації' });
      }

      const result = await syncMarketplacePrices(channel, listings, env.APP_URL);
      return successResponse(result);
    } catch {
      return errorResponse('Помилка синхронізації цін', 500);
    }
  }
);
