import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { count: vi.fn(), aggregate: vi.fn() },
    user: { count: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from './route';
import { prisma } from '@/lib/prisma';

describe('POST /api/v1/cron/weekly-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.order.count).mockResolvedValue(25);
    vi.mocked(prisma.order.aggregate).mockResolvedValue({ _sum: { totalAmount: 50000 } } as any);
    vi.mocked(prisma.user.count).mockResolvedValue(10);
    vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([
      { productId: 1, _sum: { quantity: 20 } },
    ] as any);
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 1, name: 'Product A' },
    ] as any);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('generates weekly report', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.message).toContain('25');
    expect(data.data.message).toContain('50000');
  });

  it('sends to Telegram when configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_MANAGER_CHAT_ID = 'test-chat';
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_MANAGER_CHAT_ID;
  });

  it('does not send when Telegram is not configured', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_MANAGER_CHAT_ID;
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.sent).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.order.count).mockRejectedValue(new Error('db error'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
