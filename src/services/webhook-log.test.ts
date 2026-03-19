import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { logWebhook, getWebhookLogs } from './webhook-log';

const mockPrisma = prisma as unknown as {
  webhookLog: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe('logWebhook', () => {
  it('creates a webhook log entry', async () => {
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 1 });
    await logWebhook({ source: 'telegram', event: 'message', statusCode: 200, durationMs: 50 });
    expect(mockPrisma.webhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'telegram', event: 'message', statusCode: 200, durationMs: 50 }),
    });
  });

  it('handles payload serialization', async () => {
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 1 });
    await logWebhook({ source: 'viber', event: 'callback', payload: { key: 'value' } });
    expect(mockPrisma.webhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ payload: { key: 'value' } }),
    });
  });

  it('handles DB error gracefully', async () => {
    mockPrisma.webhookLog.create.mockRejectedValue(new Error('DB error'));
    await logWebhook({ source: 'monobank', event: 'payment', statusCode: 500, error: 'fail' });
  });

  it('stores error message', async () => {
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 1 });
    await logWebhook({ source: 'liqpay', event: 'callback', error: 'Invalid signature' });
    expect(mockPrisma.webhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ error: 'Invalid signature' }),
    });
  });
});

describe('getWebhookLogs', () => {
  it('returns logs with pagination', async () => {
    mockPrisma.webhookLog.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.webhookLog.count.mockResolvedValue(1);
    const result = await getWebhookLogs({ page: 1, limit: 10 });
    expect(result).toEqual({ logs: [{ id: 1 }], total: 1 });
  });

  it('filters by source', async () => {
    mockPrisma.webhookLog.findMany.mockResolvedValue([]);
    mockPrisma.webhookLog.count.mockResolvedValue(0);
    await getWebhookLogs({ source: 'telegram' });
    expect(mockPrisma.webhookLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: 'telegram' } })
    );
  });

  it('uses default pagination', async () => {
    mockPrisma.webhookLog.findMany.mockResolvedValue([]);
    mockPrisma.webhookLog.count.mockResolvedValue(0);
    await getWebhookLogs({});
    expect(mockPrisma.webhookLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 })
    );
  });

  it('calculates skip for page 3', async () => {
    mockPrisma.webhookLog.findMany.mockResolvedValue([]);
    mockPrisma.webhookLog.count.mockResolvedValue(0);
    await getWebhookLogs({ page: 3, limit: 20 });
    expect(mockPrisma.webhookLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 })
    );
  });
});
