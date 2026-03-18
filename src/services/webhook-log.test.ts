import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { logWebhook } from './webhook-log';

const mockPrisma = prisma as unknown as {
  webhookLog: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe('logWebhook', () => {
  it('creates a webhook log entry', async () => {
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 1 });

    await logWebhook({ source: 'telegram', event: 'message', statusCode: 200, durationMs: 50 });

    expect(mockPrisma.webhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'telegram',
        event: 'message',
        statusCode: 200,
      }),
    });
  });

  it('handles errors gracefully', async () => {
    mockPrisma.webhookLog.create.mockRejectedValue(new Error('DB error'));
    // Should not throw
    await logWebhook({ source: 'viber', event: 'callback', statusCode: 500, error: 'fail' });
  });
});
