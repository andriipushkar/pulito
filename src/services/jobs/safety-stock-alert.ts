import { prisma } from '@/lib/prisma';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('safety-stock');

const DEFAULT_THRESHOLD = 5;
const ALERT_COOLDOWN_HOURS = 24;
const COOLDOWN_KEY = (productId: number) => `safety_stock_alert_${productId}`;

interface AlertedProduct {
  id: number;
  code: string;
  name: string;
  quantity: number;
}

/**
 * Finds products that are active, currently listed on at least one
 * marketplace, AND whose stock has dipped below `DEFAULT_THRESHOLD`.
 *
 * Sends a single batched Telegram message per cron run; cooldown is
 * tracked per-product so the same low SKU doesn't spam every hour.
 */
export async function alertSafetyStock(threshold = DEFAULT_THRESHOLD): Promise<{
  alerted: AlertedProduct[];
  skipped: number;
}> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      quantity: { lt: threshold, gte: 0 },
      marketplaceListings: { some: { status: 'active' } },
    },
    select: { id: true, code: true, name: true, quantity: true },
    take: 200,
  });

  const alerted: AlertedProduct[] = [];
  let skipped = 0;
  const cooldownMs = ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;

  for (const p of products) {
    const key = COOLDOWN_KEY(p.id);
    const last = await prisma.siteSetting.findUnique({ where: { key } });
    if (last?.value) {
      const t = Date.parse(last.value);
      if (!Number.isNaN(t) && Date.now() - t < cooldownMs) {
        skipped++;
        continue;
      }
    }

    alerted.push(p);
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });
  }

  if (alerted.length > 0) {
    try {
      const { notifyManagerLowStock } = await import('@/services/telegram');
      await notifyManagerLowStock(alerted);
    } catch (err) {
      log.error('safety-stock alert send failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { alerted, skipped };
}
