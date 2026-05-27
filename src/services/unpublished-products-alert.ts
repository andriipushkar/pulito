import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const DEFAULT_AGE_DAYS = 14;
const TELEGRAM_LIMIT = 15;
const APP_URL = process.env.APP_URL || 'https://pulito.trade';

interface UnpublishedReport {
  scanned: number;
  flagged: number;
  alertSent: boolean;
}

/**
 * Find active in-stock products that have zero MarketplaceListing rows older
 * than `ageDays`. These are SKUs we stock but never expose to OLX / Rozetka /
 * Prom / Epicentr — every day they sit unlisted is a lost sale. Pings the
 * manager via Telegram with a clickable batch of links to the product admin
 * pages so they can publish in a few clicks.
 */
export async function runUnpublishedProductsAlert(
  options: { ageDays?: number } = {},
): Promise<UnpublishedReport> {
  const ageDays = options.ageDays ?? DEFAULT_AGE_DAYS;
  const ageCutoff = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      quantity: { gt: 0 },
      createdAt: { lt: ageCutoff },
      marketplaceListings: { none: {} },
    },
    select: {
      id: true,
      code: true,
      name: true,
      priceRetail: true,
      quantity: true,
      createdAt: true,
    },
    orderBy: [{ ordersCount: 'desc' }, { createdAt: 'asc' }],
    take: 100,
  });

  if (candidates.length === 0) {
    return { scanned: 0, flagged: 0, alertSent: false };
  }

  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) {
    logger.warn('[unpublished-products-alert] Telegram not configured — skipping push');
    return { scanned: candidates.length, flagged: candidates.length, alertSent: false };
  }

  const top = candidates.slice(0, TELEGRAM_LIMIT);
  const lines = [
    `📦 <b>Знайдено ${candidates.length} товарів без публікації</b> (>${ageDays} днів)`,
    '',
    'Топ за продажами:',
    ...top.map((p) => {
      const price = Number(p.priceRetail).toFixed(0);
      return `• <a href="${APP_URL}/admin/products/${p.id}">${p.code}</a> — ${p.name.slice(0, 50)} (${price} ₴ × ${p.quantity})`;
    }),
  ];
  if (candidates.length > TELEGRAM_LIMIT) {
    lines.push('', `…ще ${candidates.length - TELEGRAM_LIMIT}`);
  }
  lines.push('', `<a href="${APP_URL}/admin/marketplaces">→ Опублікувати в маркетплейси</a>`);

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      logger.warn('[unpublished-products-alert] Telegram returned non-OK', {
        status: res.status,
      });
      return { scanned: candidates.length, flagged: candidates.length, alertSent: false };
    }
  } catch (err) {
    logger.error('[unpublished-products-alert] Telegram send failed', { error: String(err) });
    return { scanned: candidates.length, flagged: candidates.length, alertSent: false };
  }

  return { scanned: candidates.length, flagged: candidates.length, alertSent: true };
}
