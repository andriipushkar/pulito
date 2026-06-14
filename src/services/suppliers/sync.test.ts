import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncSupplierConsignment } from './sync';
import { SupplierChannelError } from './feed-source';
import { fetchSupplierFeedBuffer } from '@/services/suppliers/feed-source';
import { parseSupplierFeed } from '@/services/suppliers/feed-parser';
import { prisma } from '@/lib/prisma';
import type { NormalizedSupplierItem } from './feed-parser';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supplierChannel: { findUnique: vi.fn(), update: vi.fn() },
    supplierSyncLog: { create: vi.fn(), update: vi.fn() },
    product: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    priceHistory: { create: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock('@/services/cache', () => ({ cacheInvalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
// Keep the real SupplierChannelError; only stub the network fetch.
vi.mock('@/services/suppliers/feed-source', async (orig) => ({
  ...(await orig<typeof import('./feed-source')>()),
  fetchSupplierFeedBuffer: vi.fn(),
}));
vi.mock('@/services/suppliers/feed-parser', () => ({ parseSupplierFeed: vi.fn() }));

const mockFetch = vi.mocked(fetchSupplierFeedBuffer);
const mockParse = vi.mocked(parseSupplierFeed);

const CHANNEL = {
  id: 1,
  name: 'Постачальник A',
  isActive: true,
  syncMode: 'price_stock',
  format: 'yml',
  markupType: 'percent',
  markupValue: 30,
  minPrice: null,
};

function item(over: Partial<NormalizedSupplierItem>): NormalizedSupplierItem {
  return {
    sku: 'SKU',
    purchasePrice: 100,
    quantity: 5,
    available: true,
    name: null,
    barcode: null,
    ...over,
  };
}

function linkedProduct(over: Record<string, unknown> = {}) {
  return {
    id: 10,
    supplierSku: 'SKU',
    cost: 90,
    priceRetail: 117,
    quantity: 5,
    allowBackorder: false,
    markupOverrideType: null,
    markupOverrideValue: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue(CHANNEL as never);
  vi.mocked(prisma.supplierSyncLog.create).mockResolvedValue({ id: 77 } as never);
  vi.mocked(prisma.supplierChannel.update).mockResolvedValue({} as never);
  vi.mocked(prisma.supplierSyncLog.update).mockResolvedValue({} as never);
  vi.mocked(prisma.product.update).mockResolvedValue({} as never);
  vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.priceHistory.create).mockResolvedValue({} as never);
  vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([] as never);
  // Advisory lock acquired (ok:true); $transaction runs the collected write ops.
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: true }] as never);
  vi.mocked(prisma.$transaction).mockImplementation(((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma)) as never);
  mockFetch.mockResolvedValue(Buffer.from('<xml/>'));
});

describe('syncSupplierConsignment', () => {
  it('updates cost, retail (cost+markup) and stock of a matched product', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct()] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 100, quantity: 8 })]);

    const { result } = await syncSupplierConsignment(1);

    expect(result.matched).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.priceChanged).toBe(1);
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ quantity: 8, cost: 100, priceRetail: 130 }),
      }),
    );
    expect(prisma.priceHistory.create).toHaveBeenCalledTimes(1);
    expect(prisma.supplierSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('counts unmatched feed lines and never writes them', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      linkedProduct({ supplierSku: 'KNOWN' }),
    ] as never);
    mockParse.mockResolvedValue([item({ sku: 'UNKNOWN' }), item({ sku: 'KNOWN' })]);

    const { result } = await syncSupplierConsignment(1);

    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('a per-product markup override beats the channel base', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      linkedProduct({ markupOverrideType: 'fixed', markupOverrideValue: 5 }),
    ] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 100 })]);

    await syncSupplierConsignment(1);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceRetail: 105 }) }),
    );
  });

  it('null purchase price → updates stock only, leaves price untouched', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct({ quantity: 5 })] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: null, quantity: 2 })]);

    const { result } = await syncSupplierConsignment(1);

    expect(result.priceChanged).toBe(0);
    const data = vi.mocked(prisma.product.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.quantity).toBe(2);
    expect(data).not.toHaveProperty('priceRetail');
    expect(data).not.toHaveProperty('cost');
  });

  it('forces quantity 0 when the supplier marks the line unavailable', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct({ quantity: 5 })] as never);
    mockParse.mockResolvedValue([item({ available: false, quantity: 9 })]);

    await syncSupplierConsignment(1);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 0 }) }),
    );
  });

  it('FAIL-SAFE: feed error marks the log failed and writes NO product', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct()] as never);
    mockFetch.mockRejectedValue(new SupplierChannelError('502', 502));

    await expect(syncSupplierConsignment(1)).rejects.toThrow(SupplierChannelError);

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.supplierSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('refuses with 409 when the channel sync lock is already held', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct()] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 100 })]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: false }] as never);

    await expect(syncSupplierConsignment(1)).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.supplierSyncLog.create).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('marks the log failed (not stuck on running) when a write transaction throws', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct()] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 100, quantity: 8 })]);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('DB down mid-write'));

    await expect(syncSupplierConsignment(1)).rejects.toThrow('DB down mid-write');
    expect(prisma.supplierSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('dry-run computes counts but writes nothing and opens no log', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct()] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 100, quantity: 8 })]);

    const { result } = await syncSupplierConsignment(1, { dryRun: true });

    expect(result.updated).toBe(1);
    expect(result.syncLogId).toBeNull();
    expect(prisma.supplierSyncLog.create).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('converts the feed price to UAH via feedCurrencyRate', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      ...CHANNEL,
      feedCurrencyRate: 45,
      markupValue: 0,
    } as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([linkedProduct()] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 10, quantity: 5 })]); // 10 EUR

    await syncSupplierConsignment(1);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 450, priceRetail: 450 }) }),
    );
  });

  it('reserve-aware: subtracts open reserved units from supplier stock', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      ...CHANNEL,
      reserveAware: true,
    } as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      linkedProduct({ id: 10, quantity: 0 }),
    ] as never);
    vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([
      { productId: 10, _sum: { quantity: 3 } },
    ] as never);
    mockParse.mockResolvedValue([item({ quantity: 5 })]); // supplier says 5, 3 reserved → 2

    await syncSupplierConsignment(1);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 2 }) }),
    );
  });

  it('zero-missing: zeroes linked products absent from a healthy feed', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      ...CHANNEL,
      zeroMissing: true,
    } as never);
    // Two linked products; feed only mentions the first → second is "missing".
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      linkedProduct({ id: 10, supplierSku: 'A', quantity: 5 }),
      linkedProduct({ id: 11, supplierSku: 'B', quantity: 4 }),
    ] as never);
    mockParse.mockResolvedValue([item({ sku: 'A', quantity: 5 })]);

    await syncSupplierConsignment(1);

    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [11] } },
        data: expect.objectContaining({ quantity: 0 }),
      }),
    );
  });

  it('zero-missing: SKIPS when the feed matched <50% (guard against truncation)', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      ...CHANNEL,
      zeroMissing: true,
    } as never);
    // 3 linked, feed matches only 1 (33%) → must NOT zero the other two.
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      linkedProduct({ id: 10, supplierSku: 'A', quantity: 5 }),
      linkedProduct({ id: 11, supplierSku: 'B', quantity: 4 }),
      linkedProduct({ id: 12, supplierSku: 'C', quantity: 4 }),
    ] as never);
    mockParse.mockResolvedValue([item({ sku: 'A', quantity: 5 })]);

    await syncSupplierConsignment(1);

    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it('sets allowBackorder on linked products when stockPolicy = backorder', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      ...CHANNEL,
      stockPolicy: 'backorder',
    } as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      linkedProduct({ allowBackorder: false }),
    ] as never);
    mockParse.mockResolvedValue([item({ purchasePrice: 100, quantity: 0, available: false })]);

    await syncSupplierConsignment(1);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ allowBackorder: true }) }),
    );
  });

  it('rejects a channel that is not in price_stock mode', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      ...CHANNEL,
      syncMode: 'catalog_import',
    } as never);

    await expect(syncSupplierConsignment(1)).rejects.toThrow(/price_stock/);
  });
});
