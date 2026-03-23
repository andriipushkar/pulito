import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret', UPLOAD_DIR: '/tmp/uploads' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/marketplaces', () => ({ syncMarketplacePrices: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    publicationChannel: { findMany: vi.fn() },
  },
}));

import { POST } from './route';
import { syncMarketplacePrices } from '@/services/marketplaces';
import { prisma } from '@/lib/prisma';

describe('POST /api/v1/admin/marketplaces/sync-prices', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('syncs prices for channel', async () => {
    vi.mocked(prisma.publicationChannel.findMany).mockResolvedValue([
      { externalId: 'ext1', publication: { productId: 1, product: { priceRetail: 100, quantity: 5 } } },
    ] as any);
    vi.mocked(syncMarketplacePrices).mockResolvedValue({ updated: 1, failed: 0 });

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ updated: 1, failed: 0 });
  });

  it('returns 400 when channel is missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns success with 0 updated when no listings', async () => {
    vi.mocked(prisma.publicationChannel.findMany).mockResolvedValue([]);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(0);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.publicationChannel.findMany).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
