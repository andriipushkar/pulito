import { logger } from '@/lib/logger';

/**
 * Out-of-band notifications to the shop owner.
 *
 * Uses Telegram Bot API directly (no DB lookup). The owner's chat ID is
 * configured via env (TELEGRAM_MANAGER_CHAT_ID, can be a numeric private chat
 * or a channel). All sends are best-effort: a notification failure must never
 * block the underlying business action (e.g. order creation).
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const OWNER_CHAT_ID = process.env.TELEGRAM_MANAGER_CHAT_ID || '';
const APP_URL = process.env.APP_URL || 'https://pulito.trade';

interface NewOrderPayload {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  itemCount: number;
  contactName: string;
  contactPhone: string;
  deliveryMethod: string;
  deliveryCity: string | null;
}

async function sendOwnerMessage(text: string): Promise<boolean> {
  if (!BOT_TOKEN || !OWNER_CHAT_ID) {
    logger.warn('[owner-notify] TELEGRAM_BOT_TOKEN or TELEGRAM_MANAGER_CHAT_ID not set, skipping');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: OWNER_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      logger.warn('[owner-notify] sendMessage non-200', { status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[owner-notify] sendMessage error', { error: String(err) });
    return false;
  }
}

export async function notifyOwnerNewOrder(payload: NewOrderPayload): Promise<void> {
  const lines = [
    `📦 <b>Нове замовлення #${payload.orderNumber}</b>`,
    ``,
    `Сума: <b>${payload.totalAmount.toFixed(0)} ₴</b> · позицій: ${payload.itemCount}`,
    `Клієнт: ${escapeHtml(payload.contactName)} · ${escapeHtml(payload.contactPhone)}`,
    `Доставка: ${escapeHtml(payload.deliveryMethod)}${payload.deliveryCity ? ` · ${escapeHtml(payload.deliveryCity)}` : ''}`,
    ``,
    `<a href="${APP_URL}/admin/orders/${payload.orderId}">Відкрити замовлення →</a>`,
  ];
  await sendOwnerMessage(lines.join('\n'));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
