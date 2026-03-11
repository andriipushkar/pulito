import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { aggregate: vi.fn(), count: vi.fn() },
    product: { count: vi.fn() },
    user: { count: vi.fn() },
    analyticsAlert: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { checkAnalyticsAlerts } from './check-analytics-alerts';

const mockPrisma = prisma as unknown as {
  order: { aggregate: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  product: { count: ReturnType<typeof vi.fn> };
  user: { count: ReturnType<typeof vi.fn> };
  analyticsAlert: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TELEGRAM_BOT_TOKEN;
});

describe('checkAnalyticsAlerts', () => {
  it('should return zeros when no active alerts', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([]);
    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 0, triggered: 0 });
  });

  it('should check daily_revenue metric (above threshold triggered)', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_revenue',
        condition: { metric: 'daily_revenue', condition: 'above', threshold: 500 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000 } });
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
    expect(mockPrisma.analyticsAlert.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lastTriggeredAt: expect.any(Date) },
    });
  });

  it('should not trigger when value does not exceed threshold (above)', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_revenue',
        condition: { metric: 'daily_revenue', condition: 'above', threshold: 5000 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 100 } });

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 0 });
    expect(mockPrisma.analyticsAlert.update).not.toHaveBeenCalled();
  });

  it('should check daily_orders metric (below threshold triggered)', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 2,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'below', threshold: 10 },
        notificationChannels: 'telegram',
        creator: { email: 'a@t.com', telegramChatId: '12345' },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(3);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});
    process.env.TELEGRAM_BOT_TOKEN = 'botToken';
    mockFetch.mockResolvedValue({ ok: true });

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.chat_id).toBe('12345');
    expect(fetchBody.text).toContain('нижче за');
  });

  it('should check avg_check metric', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 3,
        alertType: 'avg_check',
        condition: { metric: 'avg_check', condition: 'below', threshold: 200 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.aggregate.mockResolvedValue({ _avg: { totalAmount: 150 } });
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should check stock_zero metric', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 4,
        alertType: 'stock_zero',
        condition: { metric: 'stock_zero', condition: 'above', threshold: 0 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.product.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should check new_users metric', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 5,
        alertType: 'new_users',
        condition: { metric: 'new_users', condition: 'above', threshold: 10 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(20);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should check cancelled_orders metric', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 6,
        alertType: 'cancelled_orders',
        condition: { metric: 'cancelled_orders', condition: 'above', threshold: 5 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(10);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should return 0 for unknown metric', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 7,
        alertType: 'unknown_metric',
        condition: { metric: 'unknown_metric', condition: 'above', threshold: -1 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    // value is 0, threshold is -1, above condition: 0 > -1 = true
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should use alertType as metric fallback when condition.metric is undefined', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 8,
        alertType: 'daily_orders',
        condition: { condition: 'above', threshold: 0 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should cache metric values and not query twice for same metric', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'above', threshold: 0 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
      {
        id: 2,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'below', threshold: 100 },
        notificationChannels: 'email',
        creator: { email: 'b@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    // daily_orders: 5 > 0 = triggered, 5 < 100 = triggered
    expect(result).toEqual({ checked: 2, triggered: 2 });
    // count should only be called once (cached)
    expect(mockPrisma.order.count).toHaveBeenCalledTimes(1);
  });

  it('should not send telegram when channel is not telegram', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'botToken';
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'above', threshold: 0 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: '123' },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    await checkAnalyticsAlerts();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not send telegram when creator has no telegramChatId', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'botToken';
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'above', threshold: 0 },
        notificationChannels: 'telegram',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    await checkAnalyticsAlerts();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not send telegram when bot token is missing', async () => {
    // No TELEGRAM_BOT_TOKEN set
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'above', threshold: 0 },
        notificationChannels: 'telegram',
        creator: { email: 'a@t.com', telegramChatId: '123' },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    await checkAnalyticsAlerts();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle telegram send failure gracefully', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'botToken';
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_orders',
        condition: { metric: 'daily_orders', condition: 'above', threshold: 0 },
        notificationChannels: 'telegram',
        creator: { email: 'a@t.com', telegramChatId: '123' },
      },
    ]);
    mockPrisma.order.count.mockResolvedValue(5);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should handle null totalAmount in daily_revenue', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'daily_revenue',
        condition: { metric: 'daily_revenue', condition: 'below', threshold: 100 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    // value=0, below threshold 100 -> triggered
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should handle null avg totalAmount', async () => {
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'avg_check',
        condition: { metric: 'avg_check', condition: 'below', threshold: 100 },
        notificationChannels: 'email',
        creator: { email: 'a@t.com', telegramChatId: null },
      },
    ]);
    mockPrisma.order.aggregate.mockResolvedValue({ _avg: { totalAmount: null } });
    mockPrisma.analyticsAlert.update.mockResolvedValue({});

    const result = await checkAnalyticsAlerts();
    expect(result).toEqual({ checked: 1, triggered: 1 });
  });

  it('should use unknown metric label when metric is not in METRIC_LABELS', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'botToken';
    mockPrisma.analyticsAlert.findMany.mockResolvedValue([
      {
        id: 1,
        alertType: 'custom_metric',
        condition: { metric: 'custom_metric', condition: 'above', threshold: -1 },
        notificationChannels: 'telegram',
        creator: { email: 'a@t.com', telegramChatId: '123' },
      },
    ]);
    mockPrisma.analyticsAlert.update.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true });

    await checkAnalyticsAlerts();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('custom_metric');
    expect(body.text).toContain('перевищує');
  });
});
