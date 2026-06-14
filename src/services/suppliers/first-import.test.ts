import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  previewSupplierFeed,
  linkSupplierProducts,
  unlinkSupplierProducts,
  getLinkedProducts,
  setProductMarkupOverride,
} from './first-import';
import { fetchSupplierFeedBuffer } from '@/services/suppliers/feed-source';
import { parseSupplierFeed } from '@/services/suppliers/feed-parser';
import { prisma } from '@/lib/prisma';
import type { NormalizedSupplierItem } from './feed-parser';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supplierChannel: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock('@/services/suppliers/feed-source', async (orig) => ({
  ...(await orig<typeof import('./feed-source')>()),
  fetchSupplierFeedBuffer: vi.fn(),
}));
vi.mock('@/services/suppliers/feed-parser', () => ({ parseSupplierFeed: vi.fn() }));

const mockFetch = vi.mocked(fetchSupplierFeedBuffer);
const mockParse = vi.mocked(parseSupplierFeed);

function item(over: Partial<NormalizedSupplierItem>): NormalizedSupplierItem {
  return {
    sku: 'SKU',
    purchasePrice: 100,
    quantity: 5,
    available: true,
    name: 'X',
    barcode: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({ id: 1, format: 'yml' } as never);
  mockFetch.mockResolvedValue(Buffer.from('<xml/>'));
});

describe('previewSupplierFeed', () => {
  it('classifies linked / suggested / unmatched', async () => {
    mockParse.mockResolvedValue([
      item({ sku: 'LINKED' }),
      item({ sku: 'BYCODE' }),
      item({ sku: 'NOPE', barcode: null }),
    ]);
    // First findMany = linked rows (supplierId = channel); second = candidates.
    vi.mocked(prisma.product.findMany).mockImplementation(((args: {
      where: { supplierId: unknown };
    }) => {
      if (args.where.supplierId === 1) {
        return Promise.resolve([{ id: 50, supplierSku: 'LINKED' }]);
      }
      return Promise.resolve([{ id: 60, code: 'BYCODE', name: 'Match', barcode: null }]);
    }) as never);

    const preview = await previewSupplierFeed(1);

    expect(preview.linked).toBe(1);
    expect(preview.suggested).toBe(1);
    expect(preview.unmatched).toBe(1);
    const byStatus = Object.fromEntries(preview.items.map((i) => [i.sku, i]));
    expect(byStatus.LINKED.status).toBe('linked');
    expect(byStatus.LINKED.linkedProductId).toBe(50);
    expect(byStatus.BYCODE.status).toBe('suggested');
    expect(byStatus.BYCODE.suggestion).toEqual({ productId: 60, code: 'BYCODE', name: 'Match' });
    expect(byStatus.NOPE.status).toBe('unmatched');
  });
});

describe('linkSupplierProducts', () => {
  beforeEach(() => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.product.update).mockResolvedValue({} as never);
  });

  it('links an unlinked product (allowBackorder follows the channel policy)', async () => {
    vi.mocked(prisma.supplierChannel.findUnique).mockResolvedValue({
      id: 1,
      stockPolicy: 'backorder',
    } as never);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 5, supplierId: null } as never);
    const res = await linkSupplierProducts(1, [{ sku: 'A', productId: 5 }]);
    expect(res.linked).toBe(1);
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { supplierId: 1, supplierSku: 'A', allowBackorder: true },
    });
  });

  it('skips a product linked to a different channel', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 5, supplierId: 2 } as never);
    const res = await linkSupplierProducts(1, [{ sku: 'A', productId: 5 }]);
    expect(res.linked).toBe(0);
    expect(res.skipped[0].reason).toMatch(/іншого постачальника/);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('skips duplicate SKUs within the batch', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 5, supplierId: null } as never);
    const res = await linkSupplierProducts(1, [
      { sku: 'A', productId: 5 },
      { sku: 'A', productId: 6 },
    ]);
    expect(res.linked).toBe(1);
    expect(res.skipped[0].reason).toMatch(/дубль/);
  });

  it('skips a missing product', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null as never);
    const res = await linkSupplierProducts(1, [{ sku: 'A', productId: 999 }]);
    expect(res.linked).toBe(0);
    expect(res.skipped[0].reason).toMatch(/не знайдено/);
  });

  it('links by product code when no id is given', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 7, supplierId: null } as never);
    const res = await linkSupplierProducts(1, [{ sku: 'A', productCode: 'CODE-7' }]);
    expect(res.linked).toBe(1);
    expect(prisma.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'CODE-7' } }),
    );
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { supplierId: 1, supplierSku: 'A', allowBackorder: false },
    });
  });
});

describe('unlinkSupplierProducts', () => {
  it('clears supplierId/supplierSku only for products on this channel', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 2 } as never);
    const res = await unlinkSupplierProducts(1, [5, 6]);
    expect(res.unlinked).toBe(2);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [5, 6] }, supplierId: 1 },
      data: { supplierId: null, supplierSku: null, allowBackorder: false },
    });
  });

  it('is a no-op for an empty list', async () => {
    const res = await unlinkSupplierProducts(1, []);
    expect(res.unlinked).toBe(0);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });
});

describe('getLinkedProducts', () => {
  it('maps linked products with numeric cost/price/override', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'C1',
        name: 'Товар',
        supplierSku: 'S1',
        cost: 90,
        priceRetail: 117,
        quantity: 5,
        allowBackorder: true,
        markupOverrideType: 'percent',
        markupOverrideValue: 30,
      },
    ] as never);

    const rows = await getLinkedProducts(1);
    expect(rows[0]).toEqual({
      id: 1,
      code: 'C1',
      name: 'Товар',
      supplierSku: 'S1',
      cost: 90,
      priceRetail: 117,
      quantity: 5,
      allowBackorder: true,
      markupOverrideType: 'percent',
      markupOverrideValue: 30,
    });
  });
});

describe('setProductMarkupOverride', () => {
  it('sets an override scoped to the channel', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never);
    const res = await setProductMarkupOverride(1, 5, 'fixed', 12.5);
    expect(res.updated).toBe(true);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 5, supplierId: 1 },
      data: { markupOverrideType: 'fixed', markupOverrideValue: 12.5 },
    });
  });

  it('clears the value when type is null', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never);
    await setProductMarkupOverride(1, 5, null, 99);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 5, supplierId: 1 },
      data: { markupOverrideType: null, markupOverrideValue: null },
    });
  });
});
