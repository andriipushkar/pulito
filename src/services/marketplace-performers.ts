import { prisma } from '@/lib/prisma';
import type { MarketplacePlatform } from '@/services/marketplace-health';

export interface PerformerRow {
  productCode: string;
  productName: string;
  itemsSold: number;
  grossRevenue: number;
  orderCount: number;
}

/**
 * Top/bottom N products by units sold on a specific marketplace in a window.
 * Bottom is computed only over products that DO have at least one publish
 * record for the platform — so "anti-top" is among listed-but-not-selling.
 */
export async function getPerformers(
  platform: MarketplacePlatform,
  fromDate: Date,
  limit = 10,
): Promise<{ top: PerformerRow[]; bottom: PerformerRow[] }> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        source: platform,
        createdAt: { gte: fromDate },
        status: { notIn: ['cancelled', 'returned'] },
      },
    },
    select: {
      productCode: true,
      productName: true,
      quantity: true,
      subtotal: true,
      orderId: true,
    },
  });

  const agg = new Map<string, PerformerRow>();
  for (const it of items) {
    const key = it.productCode;
    const row = agg.get(key);
    if (row) {
      row.itemsSold += it.quantity;
      row.grossRevenue += Number(it.subtotal);
      row.orderCount += 1;
    } else {
      agg.set(key, {
        productCode: key,
        productName: it.productName,
        itemsSold: it.quantity,
        grossRevenue: Number(it.subtotal),
        orderCount: 1,
      });
    }
  }

  const sorted = [...agg.values()].sort((a, b) => b.itemsSold - a.itemsSold);
  const top = sorted.slice(0, limit);

  // Bottom: products with at least one listing on this marketplace but zero
  // sales in the window. Pull listings, exclude any that appear in `agg`.
  const listings = await prisma.publicationChannel.findMany({
    where: {
      channel: platform,
      status: 'published',
      externalId: { not: null },
    },
    select: {
      externalId: true,
      publication: {
        select: {
          productId: true,
          product: { select: { code: true, name: true } },
        },
      },
    },
    take: 500,
  });
  const bottom: PerformerRow[] = [];
  for (const l of listings) {
    if (!l.publication.product) continue;
    const code = l.publication.product.code;
    if (agg.has(code)) continue;
    bottom.push({
      productCode: code,
      productName: l.publication.product.name,
      itemsSold: 0,
      grossRevenue: 0,
      orderCount: 0,
    });
    if (bottom.length >= limit) break;
  }

  return { top, bottom };
}
