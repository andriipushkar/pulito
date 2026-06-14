import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProfitReport } from './profit-report';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { findMany: vi.fn() },
    supplierChannel: { findMany: vi.fn() },
  },
}));

beforeEach(() => vi.clearAllMocks());

describe('getProfitReport', () => {
  it('computes revenue/cogs/profit with snapshot-cost preference and fallbacks', async () => {
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
      // snapshot cost preferred (60, not product.cost 50)
      {
        orderId: 1,
        productId: 1,
        productCode: 'P1',
        productName: 'A',
        quantity: 2,
        subtotal: 200,
        supplierCostAtSale: 60,
        product: { cost: 50, categoryId: 10, category: { name: 'Хімія' }, supplierId: 5 },
      },
      // no snapshot → falls back to product.cost 30; own goods
      {
        orderId: 1,
        productId: 2,
        productCode: 'P2',
        productName: 'B',
        quantity: 1,
        subtotal: 100,
        supplierCostAtSale: null,
        product: { cost: 30, categoryId: 10, category: { name: 'Хімія' }, supplierId: null },
      },
      // no cost at all → unknownCost, cogs 0; no category
      {
        orderId: 2,
        productId: 3,
        productCode: 'P3',
        productName: 'C',
        quantity: 1,
        subtotal: 40,
        supplierCostAtSale: null,
        product: { cost: null, categoryId: null, category: null, supplierId: null },
      },
      // sold below cost → loss
      {
        orderId: 2,
        productId: 4,
        productCode: 'P4',
        productName: 'D',
        quantity: 1,
        subtotal: 50,
        supplierCostAtSale: 80,
        product: { cost: null, categoryId: 10, category: { name: 'Хімія' }, supplierId: 5 },
      },
    ] as never);
    vi.mocked(prisma.supplierChannel.findMany).mockResolvedValue([
      { id: 5, name: 'Sup5' },
    ] as never);

    const r = await getProfitReport({ from: '2026-06-01', to: '2026-06-13' });

    expect(r.totals.revenue).toBe(390);
    expect(r.totals.cogs).toBe(230); // 120 + 30 + 0 + 80
    expect(r.totals.profit).toBe(160);
    expect(r.totals.units).toBe(5);
    expect(r.totals.orders).toBe(2);
    expect(r.totals.unknownCostUnits).toBe(1);

    // Top sorted by profit desc: A(80) ... D last
    expect(r.topProducts[0].label).toBe('A');
    expect(r.topProducts[0].profit).toBe(80);

    // Loss list = D only
    expect(r.lossProducts.map((p) => p.label)).toEqual(['D']);
    expect(r.lossProducts[0].profit).toBe(-30);

    // Supplier name resolved; own-goods bucket present
    const sup5 = r.bySupplier.find((s) => s.label === 'Sup5')!;
    expect(sup5.profit).toBe(50); // (200-120) + (50-80)
    const own = r.bySupplier.find((s) => s.label === 'Власний товар')!;
    expect(own.profit).toBe(110); // (100-30) + (40-0)

    // Category fallback label
    expect(r.byCategory.some((c) => c.label === 'Без категорії')).toBe(true);
  });

  it('handles an empty period', async () => {
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([] as never);
    const r = await getProfitReport({ from: '2026-06-01', to: '2026-06-13' });
    expect(r.totals.revenue).toBe(0);
    expect(r.totals.margin).toBe(0);
    expect(r.topProducts).toHaveLength(0);
    expect(prisma.supplierChannel.findMany).not.toHaveBeenCalled();
  });
});
