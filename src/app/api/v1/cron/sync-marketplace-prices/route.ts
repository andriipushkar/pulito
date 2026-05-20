import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncMarketplacePrices, MARKETPLACE_CHANNELS } from '@/services/marketplaces';
import { getChannelConfig } from '@/services/channel-config';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    // Serialise with stock/orders sync — all three mutate marketplace listings
    // and reading-then-writing stale stock figures can cause overselling.
    const locked = await withCronLock('marketplace-sync', 1800, async () => {
      const results: Record<string, { updated: number; failed: number }> = {};

      for (const channel of MARKETPLACE_CHANNELS) {
        const config = await getChannelConfig(channel);
        if (!config?.enabled) continue;

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

        if (listings.length > 0) {
          results[channel] = await syncMarketplacePrices(channel, listings, env.APP_URL);
        }
      }

      return results;
    });

    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous marketplace sync still running' });
    }

    return successResponse(locked.result);
  } catch {
    return errorResponse('Помилка синхронізації', 500);
  }
}
