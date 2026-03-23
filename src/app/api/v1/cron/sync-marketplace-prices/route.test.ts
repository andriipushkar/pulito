import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    publicationChannel: { findMany: vi.fn() },
  },
}));
vi.mock('@/services/marketplaces', () => ({
  syncMarketplacePrices: vi.fn(),
  MARKETPLACE_CHANNELS: ['rozetka', 'prom'],
}));
vi.mock('@/services/channel-config', () => ({ getChannelConfig: vi.fn() }));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { syncMarketplacePrices } from '@/services/marketplaces';
import { getChannelConfig } from '@/services/channel-config';

describe('POST /api/v1/cron/sync-marketplace-prices', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('syncs prices for enabled channels', async () => {
    vi.mocked(getChannelConfig).mockResolvedValue({ enabled: true } as any);
    vi.mocked(prisma.publicationChannel.findMany).mockResolvedValue([
      {
        externalId: 'ext-1',
        publication: { productId: 1, product: { priceRetail: 100, quantity: 10 } },
      },
    ] as any);
    vi.mocked(syncMarketplacePrices).mockResolvedValue({ updated: 1, failed: 0 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('skips disabled channels', async () => {
    vi.mocked(getChannelConfig).mockResolvedValue({ enabled: false } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(syncMarketplacePrices).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    vi.mocked(getChannelConfig).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
