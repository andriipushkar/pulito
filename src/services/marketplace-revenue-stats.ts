import { prisma } from '@/lib/prisma';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { MARKETPLACE_PLATFORMS, type MarketplacePlatform } from '@/services/marketplace-health';
import { OrderSource } from '@/../generated/prisma';

const MARKETPLACE_SOURCES: OrderSource[] = [
  OrderSource.olx,
  OrderSource.rozetka,
  OrderSource.prom,
  OrderSource.epicentrk,
];

const PLATFORM_TO_SOURCE: Record<MarketplacePlatform, OrderSource> = {
  olx: OrderSource.olx,
  rozetka: OrderSource.rozetka,
  prom: OrderSource.prom,
  epicentrk: OrderSource.epicentrk,
};

/**
 * Default commission % per platform — used when the admin hasn't set a
 * custom value in channel config (key: `commissionPercent`).
 *
 * These are public seller-fee figures as of 2026; admins should override
 * for their specific category/contract via the settings tab.
 */
const DEFAULT_COMMISSION: Record<MarketplacePlatform, number> = {
  olx: 0, // OLX charges per-listing, not %
  rozetka: 12,
  prom: 8,
  epicentrk: 10,
};

export interface MarketplaceRevenueStats {
  platform: MarketplacePlatform;
  orders: number;
  grossRevenue: number;
  commissionPercent: number;
  commissionAmount: number;
  netRevenue: number;
  aov: number; // average order value
  itemsSold: number;
}

export interface RevenueDashboard {
  from: string;
  to: string;
  byPlatform: MarketplaceRevenueStats[];
  totals: {
    orders: number;
    grossRevenue: number;
    commissionAmount: number;
    netRevenue: number;
    aov: number;
  };
  ownSite: {
    orders: number;
    grossRevenue: number;
    aov: number;
  };
}

export async function computeRevenueDashboard(
  fromDate: Date,
  toDate: Date,
): Promise<RevenueDashboard> {
  const byPlatform: MarketplaceRevenueStats[] = [];
  for (const platform of MARKETPLACE_PLATFORMS) {
    const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
    const commissionRaw = config?.commissionPercent;
    const commissionPercent =
      typeof commissionRaw === 'number'
        ? commissionRaw
        : typeof commissionRaw === 'string'
        ? parseFloat(commissionRaw) || DEFAULT_COMMISSION[platform]
        : DEFAULT_COMMISSION[platform];

    const orders = await prisma.order.findMany({
      where: {
        source: PLATFORM_TO_SOURCE[platform],
        createdAt: { gte: fromDate, lte: toDate },
        status: { notIn: ['cancelled', 'returned'] },
      },
      select: { totalAmount: true, itemsCount: true },
    });

    const ordersCount = orders.length;
    const gross = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const itemsSold = orders.reduce((s, o) => s + o.itemsCount, 0);
    const commissionAmount = Math.round((gross * commissionPercent) / 100 * 100) / 100;
    const net = Math.round((gross - commissionAmount) * 100) / 100;
    const aov = ordersCount > 0 ? Math.round((gross / ordersCount) * 100) / 100 : 0;

    byPlatform.push({
      platform,
      orders: ordersCount,
      grossRevenue: gross,
      commissionPercent,
      commissionAmount,
      netRevenue: net,
      aov,
      itemsSold,
    });
  }

  const totalOrders = byPlatform.reduce((s, p) => s + p.orders, 0);
  const totalGross = byPlatform.reduce((s, p) => s + p.grossRevenue, 0);
  const totalCommission = byPlatform.reduce((s, p) => s + p.commissionAmount, 0);
  const totalNet = byPlatform.reduce((s, p) => s + p.netRevenue, 0);
  const totalAov = totalOrders > 0 ? Math.round((totalGross / totalOrders) * 100) / 100 : 0;

  // Own-site = orders whose source isn't one of the marketplace platforms.
  const ownOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: fromDate, lte: toDate },
      status: { notIn: ['cancelled', 'returned'] },
      source: { notIn: MARKETPLACE_SOURCES },
    },
    select: { totalAmount: true },
  });
  const ownCount = ownOrders.length;
  const ownGross = ownOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const ownAov = ownCount > 0 ? Math.round((ownGross / ownCount) * 100) / 100 : 0;

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    byPlatform,
    totals: {
      orders: totalOrders,
      grossRevenue: totalGross,
      commissionAmount: totalCommission,
      netRevenue: totalNet,
      aov: totalAov,
    },
    ownSite: { orders: ownCount, grossRevenue: ownGross, aov: ownAov },
  };
}
