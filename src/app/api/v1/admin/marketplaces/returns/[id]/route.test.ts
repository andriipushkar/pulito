import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) =>
    (handler: any) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 1 }, ...(ctx || {}) }),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceReturn: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    product: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock('@/services/marketplace-sync', () => ({
  pushReturnDecision: vi.fn(),
  syncProductsStockToMarketplaces: vi.fn(),
}));
vi.mock('@/services/marketplace-health', () => ({
  isMarketplacePlatform: (p: string) => ['olx', 'rozetka', 'prom', 'epicentrk'].includes(p),
}));
vi.mock('@/services/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH } from './route';
import { prisma } from '@/lib/prisma';
import { pushReturnDecision } from '@/services/marketplace-sync';

const mockPush = vi.mocked(pushReturnDecision);

const makeExisting = (over: Record<string, unknown> = {}) => ({
  id: 1,
  externalReturnId: 'ext-1',
  connection: { platform: 'rozetka' },
  order: null,
  ...over,
});

describe('PATCH /api/v1/admin/marketplaces/returns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockResolvedValue({ success: true });
  });

  it('updates return status and pushes decision to marketplace', async () => {
    const updated = { id: 1, status: 'approved', connection: { platform: 'rozetka' } };
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(makeExisting() as any);
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue(updated as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(1);
    expect(json.data.pushWarning).toBeNull();
    expect(json.data.restocked).toBe(0);
    expect(mockPush).toHaveBeenCalledWith('rozetka', 'ext-1', 'approved');
  });

  it('restocks order items when completed with restockProducts=true', async () => {
    const orderWithItems = {
      id: 1,
      externalReturnId: 'ext-1',
      connection: { platform: 'rozetka' },
      order: {
        id: 7,
        items: [
          { productCode: 'SKU-1', quantity: 2 },
          { productCode: 'SKU-2', quantity: 1 },
        ],
      },
    };
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(orderWithItems as any);
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue({
      id: 1,
      status: 'completed',
      connection: { platform: 'rozetka' },
    } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', restockProducts: true }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.restocked).toBe(2);
    expect(prisma.product.updateMany).toHaveBeenCalledTimes(2);
    expect((prisma.product.updateMany as any).mock.calls[0][0]).toMatchObject({
      where: { code: 'SKU-1' },
      data: { quantity: { increment: 2 } },
    });
  });

  it('does not restock when restockProducts=false (default)', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(
      makeExisting({
        order: { id: 7, items: [{ productCode: 'SKU-1', quantity: 2 }] },
      }) as any,
    );
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue({
      id: 1,
      status: 'completed',
      connection: { platform: 'rozetka' },
    } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it('surfaces pushWarning when marketplace push fails but still updates locally', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(makeExisting() as any);
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue({
      id: 1,
      status: 'rejected',
      connection: { platform: 'rozetka' },
    } as any);
    mockPush.mockResolvedValue({ success: false, error: 'HTTP 502' });

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.pushWarning).toBe('HTTP 502');
    expect(prisma.marketplaceReturn.update).toHaveBeenCalled();
  });

  it('skips push when skipPush=true is passed', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(makeExisting() as any);
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue({
      id: 1,
      status: 'approved',
      connection: { platform: 'rozetka' },
    } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', skipPush: true }),
    });
    await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not push when status is pending (no decision)', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(makeExisting() as any);
    vi.mocked(prisma.marketplaceReturn.update).mockResolvedValue({
      id: 1,
      status: 'pending',
      connection: { platform: 'rozetka' },
    } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    });
    await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when return not found', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockResolvedValue(null as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '999' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.marketplaceReturn.findUnique).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
