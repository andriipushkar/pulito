import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';

interface ProcessResult {
  scanned: number;
  notified: number;
  failed: number;
}

/**
 * Scan back_in_stock_subscriptions for un-notified rows whose product has
 * returned to stock. Send email per row, mark notifiedAt on success.
 *
 * Called from /api/v1/cron/back-in-stock on a schedule (~hourly).
 * Batches per-product to avoid N+1 fetches and spreads sends across the run.
 */
export async function processBackInStockNotifications(): Promise<ProcessResult> {
  const result: ProcessResult = { scanned: 0, notified: 0, failed: 0 };

  // Find subscriptions whose product is now in stock — limit per run so a backlog
  // doesn't block the cron slot.
  const pending = await prisma.backInStockSubscription.findMany({
    where: {
      notifiedAt: null,
      product: { isActive: true, quantity: { gt: 0 } },
    },
    take: 200,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          quantity: true,
          priceRetail: true,
          imagePath: true,
        },
      },
    },
  });

  result.scanned = pending.length;
  if (pending.length === 0) return result;

  const baseUrl = env.APP_URL || 'https://pulito.trade';

  for (const sub of pending) {
    const productUrl = `${baseUrl}/product/${sub.product.slug}`;
    const subject = `«${sub.product.name}» знову в наявності!`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #212121;">
        <h2 style="margin: 0 0 16px; font-size: 22px;">🎉 Товар знову в наявності</h2>
        <p style="margin: 0 0 16px; line-height: 1.5;">
          Привіт! Ви підписалися на сповіщення про надходження товару — він уже на складі і його можна замовити.
        </p>
        <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          ${sub.product.imagePath ? `<img src="${baseUrl}${sub.product.imagePath}" alt="" style="max-width: 200px; height: auto; border-radius: 8px; margin-bottom: 12px;" />` : ''}
          <h3 style="margin: 0 0 8px; font-size: 18px;">${escapeHtml(sub.product.name)}</h3>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #1565c0;">${Number(sub.product.priceRetail).toFixed(0)} ₴</p>
        </div>
        <p style="margin: 16px 0;">
          <a href="${productUrl}" style="display: inline-block; background: #1565c0; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Перейти до товару
          </a>
        </p>
        <p style="margin: 24px 0 0; font-size: 12px; color: #757575;">
          Pulito Trade · <a href="${baseUrl}" style="color: #1565c0;">${baseUrl.replace(/^https?:\/\//, '')}</a>
        </p>
      </div>
    `;

    try {
      const sendResult = await sendEmail({ to: sub.email, subject, html });
      if (sendResult.success) {
        await prisma.backInStockSubscription.update({
          where: { id: sub.id },
          data: { notifiedAt: new Date() },
        });
        result.notified++;
      } else {
        result.failed++;
        logger.warn('[back-in-stock] email send failed', {
          subscriptionId: sub.id,
          email: sub.email,
          error: sendResult.error,
        });
      }
    } catch (err) {
      result.failed++;
      logger.error('[back-in-stock] notification failed', {
        subscriptionId: sub.id,
        email: sub.email,
        error: String(err),
      });
    }
  }

  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
