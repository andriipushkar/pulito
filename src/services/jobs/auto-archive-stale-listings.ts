import { prisma } from '@/lib/prisma';
import { archiveListing } from '@/services/marketplace-listing-archive';
import { marketplaceLogger } from '@/services/marketplace-logger';
import { OrderSource } from '@/../generated/prisma';

const CHANNEL_TO_SOURCE: Record<string, OrderSource | undefined> = {
  olx: OrderSource.olx,
  rozetka: OrderSource.rozetka,
  prom: OrderSource.prom,
  epicentrk: OrderSource.epicentrk,
};

const log = marketplaceLogger('auto-archive');
const STALE_DAYS = 90;

/**
 * Pauses (status='paused') any marketplace listing whose linked product
 * hasn't had an order in STALE_DAYS — keeps the listing on the marketplace
 * (no DELETE), just toggles status so the next stock-sync sets quantity=0.
 *
 * We pause rather than archive to give the admin a chance to manually
 * boost/promote the listing before fully retiring it.
 */
export async function autoArchiveStaleListings(): Promise<{
  paused: number;
  scanned: number;
}> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const listings = await prisma.publicationChannel.findMany({
    where: {
      status: 'published',
      channel: { in: ['olx', 'rozetka', 'prom', 'epicentrk'] },
      externalId: { not: null },
      publishedAt: { lt: cutoff },
    },
    select: {
      id: true,
      channel: true,
      publication: { select: { productId: true } },
    },
    take: 1000,
  });

  let paused = 0;
  for (const l of listings) {
    if (!l.publication.productId) continue;

    // Check if any order item references this product in the last STALE_DAYS.
    // OrderItem doesn't store productId directly — it uses productCode. Look
    // up the product code and search by it.
    const product = await prisma.product.findUnique({
      where: { id: l.publication.productId },
      select: { code: true },
    });
    if (!product?.code) continue;

    const sourceEnum = CHANNEL_TO_SOURCE[l.channel];
    if (!sourceEnum) continue;
    const recentOrderCount = await prisma.orderItem.count({
      where: {
        productCode: product.code,
        order: { createdAt: { gte: cutoff }, source: sourceEnum },
      },
    });
    if (recentOrderCount > 0) continue;

    try {
      await archiveListing(l.id);
      paused++;
    } catch (err) {
      log.error('auto-archive failed', {
        id: l.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { paused, scanned: listings.length };
}
