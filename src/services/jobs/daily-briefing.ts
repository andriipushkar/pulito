import { prisma } from '@/lib/prisma';
import { sendEmail } from '../email';
import { getDashboardStats } from '../dashboard';
import { generateDashboardSummary } from '../ai-dashboard';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';

/**
 * Daily AI executive briefing for shop owner. Same logic as the dashboard
 * widget, but pushed by cron to admin/manager inboxes at 8:00 Kyiv.
 */
export async function sendDailyBriefing(): Promise<{ sent: number; total: number }> {
  const stats = await getDashboardStats();

  const unpaidCount = await prisma.order
    .count({
      where: {
        paymentStatus: 'pending',
        status: { notIn: ['cancelled', 'returned'] },
      },
    })
    .catch(() => 0);

  const dateLabel = new Date().toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const summary = await generateDashboardSummary({
    dateLabel,
    orders: {
      todayCount: stats.orders.todayCount,
      todayRevenue: stats.orders.todayRevenue,
      yesterdayCount: stats.orders.yesterdayCount,
      yesterdayRevenue: stats.orders.yesterdayRevenue,
      newCount: stats.orders.newCount,
      unpaidCount,
    },
    weeklyRevenue: stats.weeklyRevenue,
    users: {
      total: stats.users.total,
      newThisWeek: stats.users.newThisWeek,
      pendingWholesale: stats.users.pendingWholesale,
    },
    products: {
      total: stats.products.total,
      outOfStock: stats.products.outOfStock,
      lowStock: stats.products.lowStock,
      missingBarcode: stats.products.withoutBarcode,
    },
    topProducts: stats.topProducts.slice(0, 5).map((p) => ({
      name: p.name,
      sales: p.quantity,
    })),
    recommendations: [],
  });

  const baseUrl = env.APP_URL || 'https://pulito.trade';
  const subject = `Брифінг Pulito Trade — ${dateLabel}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #212121;">
      <h2 style="margin: 0 0 16px; font-size: 22px;">📊 Брифінг дня</h2>
      <p style="margin: 0 0 20px; font-size: 13px; color: #757575;">${dateLabel} · згенеровано ${summary.provider === 'rules' ? 'шаблон' : summary.provider}</p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 16px; line-height: 1.6; font-size: 15px;">
        ${summary.text.replace(/\n/g, '<br>')}
      </div>
      <p style="margin: 24px 0 0;">
        <a href="${baseUrl}/admin" style="display: inline-block; background: #1565c0; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Відкрити дашборд
        </a>
      </p>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9e9e9e;">
        Цей лист згенеровано автоматично. Щоб налаштувати канали — Адмін → Налаштування → AI.
      </p>
    </div>
  `;

  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager'] }, isVerified: true },
    select: { email: true },
  });

  let sent = 0;
  for (const admin of admins) {
    try {
      const r = await sendEmail({ to: admin.email, subject, html });
      if (r.success) sent++;
    } catch (err) {
      logger.warn('[daily-briefing] send failed', { to: admin.email, error: String(err) });
    }
  }

  return { sent, total: admins.length };
}
