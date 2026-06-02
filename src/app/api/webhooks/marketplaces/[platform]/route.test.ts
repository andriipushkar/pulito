import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findFirst: vi.fn(), update: vi.fn() },
    publicationChannel: { updateMany: vi.fn() },
    marketplaceReturn: { upsert: vi.fn() },
    siteSetting: { upsert: vi.fn() },
    webhookLog: { create: vi.fn() },
  },
}));
vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));
vi.mock('@/services/marketplace-sync', () => ({
  getOrCreateConnectionId: vi.fn().mockResolvedValue(99),
  importOrdersFromMarketplace: vi.fn().mockResolvedValue({ imported: 1, skipped: 0, failed: 0 }),
  mapReturnStatus: (s: string) => {
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    if (s === 'completed') return 'completed';
    return 'pending';
  },
}));
vi.mock('@/services/marketplace-messages-sync', () => ({
  syncMarketplaceMessages: vi.fn().mockResolvedValue({ synced: 0, perPlatform: {} }),
}));
// Dedup uses redis SET NX (→ 'OK' = first-seen) and the rate-limiter uses
// incr/expire. Mock all of them: a real redis on the box would return a stale
// dedup key (TTL 24h) from a prior run, masking every event as a duplicate and
// skipping the handlers/log.
vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getChannelConfig } from '@/services/channel-config';
import { importOrdersFromMarketplace } from '@/services/marketplace-sync';
import { syncMarketplaceMessages } from '@/services/marketplace-messages-sync';

const mockConfig = vi.mocked(getChannelConfig);
const mockOrderFind = vi.mocked(prisma.order.findFirst);
const mockOrderUpdate = vi.mocked(prisma.order.update);
const mockListingUpdate = vi.mocked(prisma.publicationChannel.updateMany);
const mockReturnUpsert = vi.mocked(prisma.marketplaceReturn.upsert);
const mockWebhookCreate = vi.mocked(prisma.webhookLog.create);

const makeReq = (
  body: unknown,
  opts: { headers?: Record<string, string>; bodyOverride?: string } = {},
) =>
  new Request('http://localhost/api/webhooks/marketplaces/rozetka', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.bodyOverride ?? JSON.stringify(body),
  });

const params = (p: string) => ({ params: Promise.resolve({ platform: p }) });

describe('Marketplace webhook POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.mockResolvedValue(null);
    mockWebhookCreate.mockResolvedValue({} as any);
  });

  it('404s on unknown platform', async () => {
    const res = await POST(makeReq({}) as any, params('amazon'));
    expect(res.status).toBe(404);
  });

  it('400s on invalid JSON', async () => {
    const res = await POST(makeReq({}, { bodyOverride: 'not-json{' }) as any, params('rozetka'));
    expect(res.status).toBe(400);
  });

  it('logs webhook with statusCode and durationMs', async () => {
    await POST(makeReq({ event: 'unknown' }) as any, params('rozetka'));
    expect(mockWebhookCreate).toHaveBeenCalledTimes(1);
    const data = mockWebhookCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.statusCode).toBe(200);
    expect(typeof data.durationMs).toBe('number');
    expect(data.error).toBeNull();
  });

  it('rejects bad HMAC signature when webhookSecret is configured', async () => {
    mockConfig.mockResolvedValue({ enabled: true, webhookSecret: 'shh' } as any);
    const res = await POST(
      makeReq({ event: 'order_created' }, { headers: { 'x-rozetka-sign': 'wrong' } }) as any,
      params('rozetka'),
    );
    expect(res.status).toBe(401);
    // The log should record the rejection
    const data = mockWebhookCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.statusCode).toBe(401);
    expect(data.error).toBe('Invalid signature');
  });

  it('accepts valid HMAC signature', async () => {
    mockConfig.mockResolvedValue({ enabled: true, webhookSecret: 'shh' } as any);
    const body = JSON.stringify({ event: 'order_created', data: { id: 'abc' } });
    const sig = createHmac('sha256', 'shh').update(body).digest('hex');

    const req = new Request('http://localhost/api/webhooks/marketplaces/rozetka', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rozetka-sign': `sha256=${sig}` },
      body,
    });
    const res = await POST(req as any, params('rozetka'));
    expect(res.status).toBe(200);
  });

  it('triggers importOrdersFromMarketplace on order.created when order is new', async () => {
    mockOrderFind.mockResolvedValue(null);

    await POST(makeReq({ event: 'order_created', data: { id: '500' } }) as any, params('rozetka'));

    // void-promise — give microtasks a tick
    await new Promise((r) => setImmediate(r));
    expect(importOrdersFromMarketplace).toHaveBeenCalledWith('rozetka');
  });

  it('updates order status on order.updated', async () => {
    mockOrderFind.mockResolvedValue({ id: 1 } as any);

    const res = await POST(
      makeReq({
        event: 'order_status_changed',
        data: { id: '500', status: 'shipped' },
      }) as any,
      params('rozetka'),
    );

    expect(res.status).toBe(200);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'shipped' },
    });
  });

  it('updates publication channel on listing.rejected', async () => {
    await POST(
      makeReq({
        event: 'advert_status_changed',
        data: { id: 'ad-1', status: 'rejected', reason: 'Bad photo' },
      }) as any,
      params('rozetka'),
    );

    expect(mockListingUpdate).toHaveBeenCalledWith({
      where: { channel: 'rozetka', externalId: 'ad-1' },
      data: { status: 'failed', errorMessage: 'Bad photo' },
    });
  });

  it('upserts marketplace return on return.created', async () => {
    mockOrderFind.mockResolvedValue({ id: 7 } as any);

    await POST(
      makeReq({
        event: 'return_created',
        data: {
          id: 'r-1',
          order_id: 'ord-1',
          reason: 'broken',
          status: 'pending',
          quantity: 1,
          refund_amount: 100,
        },
      }) as any,
      params('rozetka'),
    );

    expect(mockReturnUpsert).toHaveBeenCalledTimes(1);
    const args = mockReturnUpsert.mock.calls[0][0] as any;
    expect(args.create).toMatchObject({
      externalReturnId: 'r-1',
      orderId: 7,
      reason: 'broken',
      status: 'pending',
      quantity: 1,
      refundAmount: 100,
    });
  });

  it('triggers syncMarketplaceMessages on message.received', async () => {
    await POST(
      makeReq({ event: 'message_received', data: { id: 'msg-1' } }) as any,
      params('rozetka'),
    );

    await new Promise((r) => setImmediate(r));
    expect(syncMarketplaceMessages).toHaveBeenCalled();
  });

  it('returns 200 (not 500) when handler throws — payload preserved in log', async () => {
    mockOrderFind.mockResolvedValue({ id: 1 } as any);
    mockOrderUpdate.mockRejectedValue(new Error('DB constraint'));

    const res = await POST(
      makeReq({
        event: 'order_status_changed',
        data: { id: '500', status: 'shipped' },
      }) as any,
      params('rozetka'),
    );

    expect(res.status).toBe(200);
    const data = mockWebhookCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.statusCode).toBe(500);
    expect(data.error).toBe('DB constraint');
  });
});
