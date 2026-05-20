import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockClient, MockClientClass, mockTxOrder, mockTxProduct } = vi.hoisted(() => {
  const mockClient = {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    updateStock: vi.fn(),
    getOrders: vi.fn(),
  };
  class MockClientClass {
    createProduct = mockClient.createProduct;
    updateProduct = mockClient.updateProduct;
    updateStock = mockClient.updateStock;
    getOrders = mockClient.getOrders;
  }
  const mockTxOrder = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const mockTxProduct = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };
  return { mockClient, MockClientClass, mockTxOrder, mockTxProduct };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    publicationChannel: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    order: { findFirst: vi.fn(), create: vi.fn() },
    siteSetting: { upsert: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({ order: mockTxOrder, product: mockTxProduct }),
    ),
  },
}));

vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));

vi.mock('./marketplace-rozetka', () => ({
  RozetkaClient: MockClientClass,
}));

vi.mock('./marketplace-prom', () => ({
  PromClient: MockClientClass,
}));

import { prisma } from '@/lib/prisma';
import { getChannelConfig } from '@/services/channel-config';
import {
  syncProductsToMarketplace,
  syncStockToMarketplace,
  importOrdersFromMarketplace,
  getConnectionStatus,
  pushReturnDecision,
} from './marketplace-sync';

const mockPrisma = prisma as unknown as {
  product: { findMany: ReturnType<typeof vi.fn> };
  publicationChannel: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  order: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  siteSetting: { upsert: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

const mockGetChannelConfig = getChannelConfig as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockTxOrder.findFirst.mockResolvedValue(null);
  mockTxOrder.create.mockResolvedValue({ id: 1 });
});

describe('syncProductsToMarketplace', () => {
  it('should throw when platform is not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);
    await expect(syncProductsToMarketplace('rozetka')).rejects.toThrow();
  });

  it('should throw when platform is disabled', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: false });
    await expect(syncProductsToMarketplace('rozetka')).rejects.toThrow();
  });

  it('should create new listings for products without externalId', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Product A',
        content: { fullDescription: 'Desc A' },
        priceRetail: 100,
        code: 'P001',
        quantity: 10,
        images: [{ pathFull: 'img1.jpg', pathOriginal: null, pathMedium: null }],
        publications: [{ id: 10, channelResults: [] }],
      },
    ]);
    mockClient.createProduct.mockResolvedValue({ success: true, externalId: 'ext-1' });
    mockPrisma.publicationChannel.upsert.mockResolvedValue({});
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncProductsToMarketplace('rozetka');

    expect(result).toEqual({ created: 1, updated: 0, failed: 0 });
    expect(mockClient.createProduct).toHaveBeenCalledTimes(1);
    expect(mockPrisma.publicationChannel.upsert).toHaveBeenCalledTimes(1);
  });

  it('should update existing listings with externalId', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 2,
        name: 'Product B',
        description: 'Desc B',
        priceRetail: 200,
        code: 'P002',
        quantity: 5,
        images: [],
        publications: [{ id: 20, channelResults: [{ externalId: 'ext-2', status: 'published' }] }],
      },
    ]);
    mockClient.updateProduct.mockResolvedValue({ success: true });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncProductsToMarketplace('rozetka');

    expect(result).toEqual({ created: 0, updated: 1, failed: 0 });
    expect(mockClient.updateProduct).toHaveBeenCalledWith('ext-2', {
      name: 'Product B',
      price: 200,
      quantity: 5,
    });
  });

  it('should count failures when client returns success: false', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 3,
        name: 'Product C',
        description: null,
        priceRetail: 50,
        code: 'P003',
        quantity: 1,
        images: [],
        publications: [{ id: 30, channelResults: [{ externalId: 'ext-3', status: 'published' }] }],
      },
    ]);
    mockClient.updateProduct.mockResolvedValue({ success: false });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncProductsToMarketplace('rozetka');

    expect(result).toEqual({ created: 0, updated: 0, failed: 1 });
  });

  it('should count failures when client throws an error', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 4,
        name: 'Product D',
        description: null,
        priceRetail: 75,
        code: 'P004',
        quantity: 2,
        images: [],
        publications: [{ id: 40, channelResults: [] }],
      },
    ]);
    mockClient.createProduct.mockRejectedValue(new Error('Network error'));
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncProductsToMarketplace('rozetka');

    expect(result).toEqual({ created: 0, updated: 0, failed: 1 });
  });

  it('should handle mixed create/update/fail correctly', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'New',
        description: null,
        priceRetail: 100,
        code: 'A',
        quantity: 1,
        images: [],
        publications: [{ id: 1, channelResults: [] }],
      },
      {
        id: 2,
        name: 'Update',
        description: null,
        priceRetail: 200,
        code: 'B',
        quantity: 2,
        images: [],
        publications: [{ id: 2, channelResults: [{ externalId: 'e2', status: 'published' }] }],
      },
      {
        id: 3,
        name: 'Fail',
        description: null,
        priceRetail: 300,
        code: 'C',
        quantity: 3,
        images: [],
        publications: [{ id: 3, channelResults: [] }],
      },
    ]);
    mockClient.createProduct
      .mockResolvedValueOnce({ success: true, externalId: 'new-1' })
      .mockRejectedValueOnce(new Error('fail'));
    mockClient.updateProduct.mockResolvedValue({ success: true });
    mockPrisma.publicationChannel.upsert.mockResolvedValue({});
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncProductsToMarketplace('rozetka');

    expect(result).toEqual({ created: 1, updated: 1, failed: 1 });
  });
});

describe('syncStockToMarketplace', () => {
  it('should throw when platform is not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);
    await expect(syncStockToMarketplace('prom')).rejects.toThrow();
  });

  it('should update stock for published listings', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiToken: 'tok' });
    mockPrisma.publicationChannel.findMany.mockResolvedValue([
      {
        externalId: 'ext-10',
        publication: { productId: 1, product: { quantity: 15, priceRetail: 100 } },
      },
      {
        externalId: 'ext-11',
        publication: { productId: 2, product: { quantity: 8, priceRetail: 200 } },
      },
    ]);
    mockClient.updateStock.mockResolvedValue({ success: true });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncStockToMarketplace('prom');

    expect(result).toEqual({ updated: 2, failed: 0 });
    expect(mockClient.updateStock).toHaveBeenCalledWith('ext-10', 15);
    expect(mockClient.updateStock).toHaveBeenCalledWith('ext-11', 8);
  });

  it('should handle API errors and count failures', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiToken: 'tok' });
    mockPrisma.publicationChannel.findMany.mockResolvedValue([
      {
        externalId: 'ext-20',
        publication: { productId: 1, product: { quantity: 5, priceRetail: 50 } },
      },
    ]);
    mockClient.updateStock.mockRejectedValue(new Error('API timeout'));
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncStockToMarketplace('prom');

    expect(result).toEqual({ updated: 0, failed: 1 });
  });

  it('should skip entries without externalId or product', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiToken: 'tok' });
    mockPrisma.publicationChannel.findMany.mockResolvedValue([
      {
        externalId: null,
        publication: { productId: 1, product: { quantity: 5, priceRetail: 50 } },
      },
      { externalId: 'ext-30', publication: { productId: 2, product: null } },
    ]);
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await syncStockToMarketplace('prom');

    expect(result).toEqual({ updated: 0, failed: 0 });
    expect(mockClient.updateStock).not.toHaveBeenCalled();
  });
});

describe('importOrdersFromMarketplace', () => {
  it('should throw when platform is not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);
    await expect(importOrdersFromMarketplace('rozetka')).rejects.toThrow();
  });

  it('should import new orders', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockClient.getOrders.mockResolvedValue([
      {
        id: 100,
        status: 'new',
        amount: 500,
        buyer: { name: 'John', phone: '+380999999999' },
        items: [{ name: 'Widget', quantity: 2, price: 250 }],
      },
    ]);
    mockTxOrder.findFirst.mockResolvedValue(null);
    mockTxOrder.create.mockResolvedValue({ id: 1 });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await importOrdersFromMarketplace('rozetka');

    expect(result).toEqual({ imported: 1, skipped: 0, failed: 0 });
    expect(mockTxOrder.create).toHaveBeenCalledTimes(1);
    expect(mockTxOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalId: '100',
          source: 'rozetka',
          status: 'new_order',
          totalAmount: 500,
          contactName: 'John',
          contactPhone: '+380999999999',
        }),
      }),
    );
  });

  it('should skip existing orders (dedup by externalId)', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockClient.getOrders.mockResolvedValue([
      {
        id: 200,
        status: 'new',
        amount: 300,
        buyer: { name: 'Jane', phone: '+380111111111' },
        items: [{ name: 'Gadget', quantity: 1, price: 300 }],
      },
    ]);
    mockTxOrder.findFirst.mockResolvedValue({ id: 5, externalId: '200' });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await importOrdersFromMarketplace('rozetka');

    expect(result).toEqual({ imported: 0, skipped: 1, failed: 0 });
    expect(mockTxOrder.create).not.toHaveBeenCalled();
  });

  it('decrements local product stock when item has a code', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockClient.getOrders.mockResolvedValue([
      {
        id: 400,
        status: 'new',
        amount: 200,
        buyer: { name: 'Buyer', phone: '+380333333333' },
        items: [{ name: 'Item', quantity: 3, price: 200, id: 'SKU-1' }],
      },
    ]);
    mockTxOrder.findFirst.mockResolvedValue(null);
    mockTxOrder.create.mockResolvedValue({ id: 10 });
    mockTxProduct.findUnique.mockResolvedValue({ id: 77 });
    mockTxProduct.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await importOrdersFromMarketplace('rozetka');

    expect(result).toEqual({ imported: 1, skipped: 0, failed: 0 });
    expect(mockTxProduct.updateMany).toHaveBeenCalledWith({
      where: { id: 77, quantity: { gte: 3 } },
      data: { quantity: { decrement: 3 } },
    });
    expect(mockTxProduct.update).not.toHaveBeenCalled();
  });

  it('forces quantity to 0 when local stock is insufficient', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockClient.getOrders.mockResolvedValue([
      {
        id: 500,
        status: 'new',
        amount: 100,
        buyer: { name: 'Buyer', phone: '+380444444444' },
        items: [{ name: 'Item', quantity: 5, price: 100, id: 'SKU-2' }],
      },
    ]);
    mockTxOrder.findFirst.mockResolvedValue(null);
    mockTxOrder.create.mockResolvedValue({ id: 11 });
    mockTxProduct.findUnique.mockResolvedValue({ id: 88 });
    mockTxProduct.updateMany.mockResolvedValue({ count: 0 });
    mockTxProduct.update.mockResolvedValue({ id: 88, quantity: 0 });
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await importOrdersFromMarketplace('rozetka');

    expect(result).toEqual({ imported: 1, skipped: 0, failed: 0 });
    expect(mockTxProduct.update).toHaveBeenCalledWith({
      where: { id: 88 },
      data: { quantity: 0 },
    });
  });

  it('should handle parse errors gracefully', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key', sellerId: 'shop1' });
    mockClient.getOrders.mockResolvedValue([
      {
        id: 300,
        status: 'new',
        amount: 100,
        buyer: { name: 'Error', phone: '+380222222222' },
        items: [{ name: 'Item', quantity: 1, price: 100 }],
      },
    ]);
    mockTxOrder.findFirst.mockResolvedValue(null);
    mockTxOrder.create.mockRejectedValue(new Error('DB constraint'));
    mockPrisma.siteSetting.upsert.mockResolvedValue({});

    const result = await importOrdersFromMarketplace('rozetka');

    expect(result).toEqual({ imported: 0, skipped: 0, failed: 1 });
  });
});

describe('getConnectionStatus', () => {
  it('should return correct status when connected', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'key' });
    mockPrisma.publicationChannel.count.mockResolvedValue(42);
    mockPrisma.siteSetting.findMany.mockResolvedValue([
      { key: 'marketplace_sync_rozetka_products', value: '2024-01-01T00:00:00.000Z' },
      { key: 'marketplace_sync_rozetka_stock', value: '2024-01-02T00:00:00.000Z' },
    ]);

    const result = await getConnectionStatus('rozetka');

    expect(result).toEqual({
      connected: true,
      platform: 'rozetka',
      lastSyncProducts: '2024-01-01T00:00:00.000Z',
      lastSyncStock: '2024-01-02T00:00:00.000Z',
      lastSyncOrders: null,
      publishedCount: 42,
    });
  });

  it('should return disconnected when not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);
    mockPrisma.publicationChannel.count.mockResolvedValue(0);
    mockPrisma.siteSetting.findMany.mockResolvedValue([]);

    const result = await getConnectionStatus('prom');

    expect(result).toEqual({
      connected: false,
      platform: 'prom',
      lastSyncProducts: null,
      lastSyncStock: null,
      lastSyncOrders: null,
      publishedCount: 0,
    });
  });
});

describe('pushReturnDecision', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns failure when platform is not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);
    const res = await pushReturnDecision('rozetka', 'ext-1', 'approved');
    expect(res.success).toBe(false);
  });

  it('hits Rozetka /returns/{id}/accept on approved', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'k' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('rozetka', 'ext-1', 'approved');

    expect(res.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/returns/ext-1/accept');
  });

  it('hits Rozetka /returns/{id}/reject on rejected', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'k' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('rozetka', '42', 'rejected');

    expect(res.success).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/returns/42/reject');
  });

  it('hits Prom /returns/set_status', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiToken: 't' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('prom', '7', 'completed');

    expect(res.success).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/returns/set_status');
  });

  it('treats remote 404 as success (return already finalised)', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'k' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('rozetka', '1', 'approved');

    expect(res.success).toBe(true);
  });

  it('returns failure on 5xx from marketplace', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'k' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('rozetka', '1', 'approved');

    expect(res.success).toBe(false);
    expect(res.error).toContain('502');
  });

  it('is a no-op success for OLX (no public API)', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, accessToken: 'a' });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('olx', '1', 'approved');

    expect(res.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op success for Epicentr K (no public API)', async () => {
    mockGetChannelConfig.mockResolvedValue({ enabled: true, apiKey: 'k' });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await pushReturnDecision('epicentrk', '1', 'completed');

    expect(res.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
