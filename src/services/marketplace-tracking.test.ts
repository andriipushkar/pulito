import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn() },
  },
}));
vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));
vi.mock('@/services/marketplace-rate-limit', () => ({
  recordMarketplaceCall: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { getChannelConfig } from '@/services/channel-config';
import { pushTrackingToMarketplace } from './marketplace-tracking';

const mockOrder = vi.mocked(prisma.order.findUnique);
const mockConfig = vi.mocked(getChannelConfig);

const baseOrder = {
  id: 1,
  source: 'rozetka',
  externalId: 'ext-1',
  orderNumber: 'ORD-1',
};

describe('pushTrackingToMarketplace', () => {
  const originalFetch = global.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns "not_marketplace" skip when order has no marketplace source', async () => {
    mockOrder.mockResolvedValue({ ...baseOrder, source: 'manual' } as any);
    const res = await pushTrackingToMarketplace(1, 'TTN-1');
    expect(res.success).toBe(false);
    expect(res.skipped).toBe('not_marketplace');
  });

  it('returns "no_external_id" skip when externalId is missing', async () => {
    mockOrder.mockResolvedValue({ ...baseOrder, externalId: null } as any);
    const res = await pushTrackingToMarketplace(1, 'TTN-1');
    expect(res.skipped).toBe('no_external_id');
  });

  it('returns "not_configured" skip when marketplace is disabled', async () => {
    mockOrder.mockResolvedValue(baseOrder as any);
    mockConfig.mockResolvedValue({ enabled: false } as any);
    const res = await pushTrackingToMarketplace(1, 'TTN-1');
    expect(res.skipped).toBe('not_configured');
  });

  it('pushes to Rozetka /orders/{id}/tracking', async () => {
    mockOrder.mockResolvedValue(baseOrder as any);
    mockConfig.mockResolvedValue({ enabled: true, apiKey: 'k' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushTrackingToMarketplace(1, 'TTN-1');
    expect(res.success).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/orders/ext-1/tracking');
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body as string)).toMatchObject({
      tracking_number: 'TTN-1',
      carrier: 'NovaPoshta',
    });
  });

  it('pushes to OLX /orders/{id}/fulfillment', async () => {
    mockOrder.mockResolvedValue({ ...baseOrder, source: 'olx' } as any);
    mockConfig.mockResolvedValue({ enabled: true, accessToken: 'tok' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await pushTrackingToMarketplace(1, 'TTN-OLX');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/orders/ext-1/fulfillment');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      tracking_id: 'TTN-OLX',
    });
  });

  it('pushes to Prom /orders/set_status with delivery info', async () => {
    mockOrder.mockResolvedValue({ ...baseOrder, source: 'prom', externalId: '42' } as any);
    mockConfig.mockResolvedValue({ enabled: true, apiToken: 't' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await pushTrackingToMarketplace(1, 'PROM-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/orders/set_status');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      ids: [42],
      declaration_number: 'PROM-1',
    });
  });

  it('treats 409 as success (already shipped)', async () => {
    mockOrder.mockResolvedValue(baseOrder as any);
    mockConfig.mockResolvedValue({ enabled: true, apiKey: 'k' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushTrackingToMarketplace(1, 'TTN-1');
    expect(res.success).toBe(true);
  });

  it('returns failure on 5xx', async () => {
    mockOrder.mockResolvedValue(baseOrder as any);
    mockConfig.mockResolvedValue({ enabled: true, apiKey: 'k' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushTrackingToMarketplace(1, 'TTN-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('503');
  });

  it('returns error when order not found', async () => {
    mockOrder.mockResolvedValue(null as any);
    const res = await pushTrackingToMarketplace(999, 'TTN-1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('не знайдено');
  });
});
