import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { getChannelConfig } from '@/services/channel-config';

const ANNOUNCED_KEY_PREFIX = 'promo:announced:';
const ANNOUNCED_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_BATCH_SIZE = 5;

interface AutoPostResult {
  scanned: number;
  posted: number;
  skipped: number;
  errors: number;
}

export async function autoPostPromoToTelegram(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<AutoPostResult> {
  const config = await getChannelConfig('telegram');
  if (!config?.enabled || !config.botToken || !config.channelId) {
    return { scanned: 0, posted: 0, skipped: 0, errors: 0 };
  }

  const products = await prisma.product.findMany({
    where: { isActive: true, isPromo: true },
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      priceRetail: true,
      imagePath: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: batchSize * 4, // overshoot to allow for skipped/already-announced
  });

  let posted = 0;
  let skipped = 0;
  let errors = 0;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  for (const product of products) {
    if (posted >= batchSize) break;

    const cacheKey = `${ANNOUNCED_KEY_PREFIX}${product.id}`;
    const already = await redis.get(cacheKey).catch(() => null);
    if (already) {
      skipped++;
      continue;
    }

    const url = `${appUrl}/product/${product.slug}?utm_source=telegram&utm_medium=channel&utm_campaign=promo`;
    const text = `🔥 <b>Акція!</b>\n\n<b>${product.name}</b>\nКод: ${product.code}\nЦіна: <b>${Number(product.priceRetail).toFixed(2)} ₴</b>\n\n${url}`;

    const endpoint = product.imagePath ? 'sendPhoto' : 'sendMessage';
    const body = product.imagePath
      ? {
          chat_id: config.channelId,
          photo: `${appUrl}${product.imagePath}`,
          caption: text,
          parse_mode: 'HTML',
        }
      : {
          chat_id: config.channelId,
          text,
          parse_mode: 'HTML',
        };

    try {
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      if (!data.ok) {
        errors++;
        logger.error('promo-autopost: telegram error', {
          productId: product.id,
          error: data.description,
        });
        continue;
      }
      await redis.setex(cacheKey, ANNOUNCED_TTL_SECONDS, '1').catch(() => {});
      posted++;
    } catch (error) {
      errors++;
      logger.error('promo-autopost: fetch error', {
        productId: product.id,
        error: String(error),
      });
    }
  }

  return { scanned: products.length, posted, skipped, errors };
}
