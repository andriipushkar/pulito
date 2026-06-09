import { prisma } from '@/lib/prisma';
import { todayKyiv } from '@/utils/format';

interface AlertCondition {
  metric: string;
  condition: 'above' | 'below';
  threshold: number;
}

async function getMetricValue(metric: string): Promise<number> {
  // Kyiv midnight so "daily_*" alert metrics align with the Kyiv business day.
  const today = todayKyiv();

  switch (metric) {
    case 'daily_revenue': {
      const result = await prisma.order.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { totalAmount: true },
      });
      return Number(result._sum.totalAmount || 0);
    }
    case 'daily_orders': {
      return prisma.order.count({ where: { createdAt: { gte: today } } });
    }
    case 'avg_check': {
      const result = await prisma.order.aggregate({
        where: { createdAt: { gte: today } },
        _avg: { totalAmount: true },
      });
      return Number(result._avg.totalAmount || 0);
    }
    case 'stock_zero': {
      return prisma.product.count({ where: { isActive: true, quantity: 0 } });
    }
    case 'new_users': {
      return prisma.user.count({ where: { createdAt: { gte: today } } });
    }
    case 'cancelled_orders': {
      return prisma.order.count({
        where: { status: 'cancelled', updatedAt: { gte: today } },
      });
    }
    default:
      return 0;
  }
}

function checkCondition(value: number, condition: 'above' | 'below', threshold: number): boolean {
  return condition === 'above' ? value > threshold : value < threshold;
}

const METRIC_LABELS: Record<string, string> = {
  daily_revenue: 'Денна виручка',
  daily_orders: 'Кількість замовлень',
  avg_check: 'Середній чек',
  stock_zero: 'Товарів без залишку',
  new_users: 'Нових користувачів',
  cancelled_orders: 'Скасованих замовлень',
};

export async function checkAnalyticsAlerts(): Promise<{ checked: number; triggered: number }> {
  const alerts = await prisma.analyticsAlert.findMany({
    where: { isActive: true },
    include: { creator: { select: { email: true, telegramChatId: true } } },
  });

  if (alerts.length === 0) return { checked: 0, triggered: 0 };

  let triggered = 0;

  // Group by metric to avoid duplicate queries
  const metricValues = new Map<string, number>();

  for (const alert of alerts) {
    const condition = alert.condition as unknown as AlertCondition;
    const metric = condition.metric || alert.alertType;

    if (!metricValues.has(metric)) {
      metricValues.set(metric, await getMetricValue(metric));
    }

    const value = metricValues.get(metric)!;
    const isTriggered = checkCondition(value, condition.condition, condition.threshold);

    if (isTriggered) {
      triggered++;

      const metricLabel = METRIC_LABELS[metric] || metric;
      const condLabel = condition.condition === 'above' ? 'перевищує' : 'нижче за';
      const message = `[Алерт] ${metricLabel} ${condLabel} поріг: ${value} (поріг: ${condition.threshold})`;

      // Send notification via configured channel
      if (alert.notificationChannels === 'telegram' && alert.creator.telegramChatId) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: alert.creator.telegramChatId,
                text: message,
                parse_mode: 'HTML',
              }),
            });
          }
        } catch {
          // Telegram send failed
        }
      }

      // Update lastTriggeredAt
      await prisma.analyticsAlert.update({
        where: { id: alert.id },
        data: { lastTriggeredAt: new Date() },
      });
    }
  }

  return { checked: alerts.length, triggered };
}
