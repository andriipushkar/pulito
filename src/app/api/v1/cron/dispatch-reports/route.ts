import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { sendEmail } from '@/services/email';
import { logger } from '@/lib/logger';

interface PeriodWindow {
  from: Date;
  to: Date;
  label: string;
}

function periodFor(schedule: string, now: Date): PeriodWindow | null {
  const to = now;
  if (schedule === 'daily') {
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { from, to, label: 'за останні 24 години' };
  }
  if (schedule === 'weekly') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to, label: 'за останні 7 днів' };
  }
  if (schedule === 'monthly') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to, label: 'за останні 30 днів' };
  }
  return null;
}

function shouldDispatch(schedule: string, now: Date): boolean {
  // Hour-of-day gate so the cron can run every hour but only fire the report
  // once per cycle. Schedules are anchored to UTC for simplicity — Kyiv-time
  // anchoring would need DST-aware logic.
  const hour = now.getUTCHours();
  const dow = now.getUTCDay();
  const dom = now.getUTCDate();
  if (schedule === 'daily') return hour === 6; // 06:00 UTC ≈ 09:00 Kyiv summer
  if (schedule === 'weekly') return dow === 1 && hour === 6; // Mondays
  if (schedule === 'monthly') return dom === 1 && hour === 6; // 1st of month
  return false;
}

async function buildSummary(window: PeriodWindow) {
  const [ordersCount, revenueAgg, newUsers, cancelled] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: window.from, lt: window.to } },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: window.from, lt: window.to },
        status: { notIn: ['cancelled', 'returned'] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: window.from, lt: window.to } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: window.from, lt: window.to }, status: 'cancelled' },
    }),
  ]);
  return {
    ordersCount,
    revenue: Number(revenueAgg._sum.totalAmount || 0),
    newUsers,
    cancelled,
  };
}

function renderEmailHtml(opts: {
  reportType: string;
  window: PeriodWindow;
  summary: Awaited<ReturnType<typeof buildSummary>>;
}) {
  const { reportType, window, summary } = opts;
  const fmtDate = (d: Date) => d.toLocaleDateString('uk-UA');
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 4px;font-size:20px">📊 Звіт Pulito Trade</h2>
      <p style="margin:0 0 16px;color:#666;font-size:13px">
        ${reportType} · ${window.label}<br />
        ${fmtDate(window.from)} — ${fmtDate(window.to)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr>
          <td style="padding:10px;background:#f6f7f9;border-radius:6px">
            <div style="font-size:11px;color:#666;text-transform:uppercase">Замовлення</div>
            <div style="font-size:22px;font-weight:700">${summary.ordersCount}</div>
          </td>
        </tr>
        <tr><td style="height:6px"></td></tr>
        <tr>
          <td style="padding:10px;background:#f6f7f9;border-radius:6px">
            <div style="font-size:11px;color:#666;text-transform:uppercase">Виручка</div>
            <div style="font-size:22px;font-weight:700">${summary.revenue.toFixed(0)} ₴</div>
          </td>
        </tr>
        <tr><td style="height:6px"></td></tr>
        <tr>
          <td style="padding:10px;background:#f6f7f9;border-radius:6px">
            <div style="font-size:11px;color:#666;text-transform:uppercase">Нові клієнти</div>
            <div style="font-size:22px;font-weight:700">${summary.newUsers}</div>
          </td>
        </tr>
        <tr><td style="height:6px"></td></tr>
        <tr>
          <td style="padding:10px;background:#fef2f2;border-radius:6px">
            <div style="font-size:11px;color:#666;text-transform:uppercase">Скасовані</div>
            <div style="font-size:22px;font-weight:700;color:#b91c1c">${summary.cancelled}</div>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#666">
        Цей звіт надсилається автоматично за вашою підпискою.
        <a href="https://pulito.trade/admin/reports" style="color:#0066cc">Керувати підписками</a>.
      </p>
    </div>`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const now = new Date();
    const subscriptions = await prisma.reportTemplate.findMany({
      where: { isActive: true, schedule: { not: null }, scheduleEmail: { not: null } },
    });

    const dispatched: number[] = [];
    const skipped: number[] = [];
    const failed: { id: number; error: string }[] = [];

    for (const sub of subscriptions) {
      if (!sub.schedule || !sub.scheduleEmail) continue;
      if (!shouldDispatch(sub.schedule, now)) {
        skipped.push(sub.id);
        continue;
      }
      const window = periodFor(sub.schedule, now);
      if (!window) {
        skipped.push(sub.id);
        continue;
      }
      try {
        const summary = await buildSummary(window);
        const html = renderEmailHtml({
          reportType: sub.reportType,
          window,
          summary,
        });
        await sendEmail({
          to: sub.scheduleEmail,
          subject: `Pulito Trade — звіт ${window.label}`,
          html,
        });
        dispatched.push(sub.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to dispatch scheduled report', { id: sub.id, error: message });
        failed.push({ id: sub.id, error: message });
      }
    }

    return successResponse({
      dispatched: dispatched.length,
      skipped: skipped.length,
      failed,
    });
  } catch (error) {
    logger.error('dispatch-reports cron failed', { error });
    return errorResponse('Помилка диспетчеризації звітів', 500);
  }
}
