import { prisma } from '@/lib/prisma';
import { sendEmail } from '../email';
import { env } from '@/config/env';

type DigestPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Send analytics digest emails to admin/manager users.
 * Summarizes: orders, revenue, new users, top products, stock alerts.
 */
export async function sendAnalyticsDigest(period: DigestPeriod) {
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const periodLabel = period === 'daily' ? 'Щоденний' : period === 'weekly' ? 'Щотижневий' : 'Щомісячний';
  const dateRange = `${dateFrom.toLocaleDateString('uk-UA')} — ${new Date().toLocaleDateString('uk-UA')}`;

  // Gather analytics data
  const [orderStats, newUsers, topProducts, criticalStock] = await Promise.all([
    // Order stats
    prisma.order.aggregate({
      where: { createdAt: { gte: dateFrom }, status: { notIn: ['cancelled'] } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    // New users
    prisma.user.count({ where: { createdAt: { gte: dateFrom } } }),
    // Top 5 products
    prisma.orderItem.groupBy({
      by: ['productName', 'productCode'],
      where: { order: { createdAt: { gte: dateFrom }, status: { notIn: ['cancelled', 'returned'] } } },
      _sum: { subtotal: true, quantity: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 5,
    }),
    // Critical stock
    prisma.product.count({
      where: { isActive: true, quantity: { lte: 5, gt: 0 } },
    }),
  ]);

  const totalRevenue = Number(orderStats._sum.totalAmount || 0);
  const totalOrders = orderStats._count;
  const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Build HTML email
  const topProductsHtml = topProducts.map((p, i) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${p.productCode}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${p.productName}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${Number(p._sum.quantity || 0)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${Number(p._sum.subtotal || 0).toFixed(0)} ₴</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px">
      <h2 style="color:#2563eb;margin-bottom:4px">${periodLabel} дайджест — Порошок</h2>
      <p style="color:#64748b;font-size:14px;margin-top:0">${dateRange}</p>

      <div style="display:flex;gap:16px;margin:24px 0">
        <div style="flex:1;background:#f0f9ff;border-radius:8px;padding:16px;text-align:center">
          <p style="margin:0;color:#64748b;font-size:12px">Замовлень</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e293b">${totalOrders}</p>
        </div>
        <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
          <p style="margin:0;color:#64748b;font-size:12px">Виручка</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e293b">${totalRevenue.toFixed(0)} ₴</p>
        </div>
        <div style="flex:1;background:#fefce8;border-radius:8px;padding:16px;text-align:center">
          <p style="margin:0;color:#64748b;font-size:12px">Сер. чек</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e293b">${avgCheck.toFixed(0)} ₴</p>
        </div>
      </div>

      <div style="margin:24px 0">
        <div style="display:flex;gap:16px">
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
            <p style="margin:0;color:#64748b;font-size:12px">Нових користувачів</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:bold">${newUsers}</p>
          </div>
          <div style="flex:1;background:${criticalStock > 0 ? '#fef2f2' : '#f8fafc'};border:1px solid ${criticalStock > 0 ? '#fecaca' : '#e2e8f0'};border-radius:8px;padding:12px;text-align:center">
            <p style="margin:0;color:${criticalStock > 0 ? '#dc2626' : '#64748b'};font-size:12px">Критичний запас</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:${criticalStock > 0 ? '#dc2626' : '#1e293b'}">${criticalStock} товарів</p>
          </div>
        </div>
      </div>

      ${topProducts.length > 0 ? `
        <h3 style="color:#1e293b;margin-bottom:8px">Топ-5 товарів</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px 12px;text-align:left">#</th>
              <th style="padding:8px 12px;text-align:left">Код</th>
              <th style="padding:8px 12px;text-align:left">Назва</th>
              <th style="padding:8px 12px;text-align:right">К-ть</th>
              <th style="padding:8px 12px;text-align:right">Сума</th>
            </tr>
          </thead>
          <tbody>${topProductsHtml}</tbody>
        </table>
      ` : ''}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <p style="color:#94a3b8;font-size:12px">
        Цей дайджест надіслано автоматично з <a href="${env.APP_URL}/admin/analytics" style="color:#2563eb">Порошок</a>
      </p>
    </div>
  `;

  // Get admin and manager emails
  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager'] }, isVerified: true },
    select: { email: true },
  });

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendEmail({
        to: admin.email,
        subject: `${periodLabel} дайджест — ${dateRange}`,
        html,
      });
      sent++;
    } catch {
      // Continue sending to others
    }
  }

  return { sent, total: admins.length, period };
}
