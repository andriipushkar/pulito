import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupplierReconciliation, createSupplierPayout } from './reconciliation';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { findMany: vi.fn() },
    supplierChannel: { findMany: vi.fn() },
    supplierPayout: { findMany: vi.fn(), create: vi.fn(), groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.supplierPayout.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.supplierPayout.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never); // all-time cost rows
});

describe('getSupplierReconciliation', () => {
  it('aggregates units, revenue, cost and margin per supplier, sorted by revenue', async () => {
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
      // Supplier 1: 2×(rev 100, cost 60) → units 4? no: qty fields below
      { supplierId: 1, quantity: 2, subtotal: 200, supplierCostAtSale: 60 },
      { supplierId: 1, quantity: 1, subtotal: 100, supplierCostAtSale: 60 },
      // Supplier 2: bigger revenue
      { supplierId: 2, quantity: 5, subtotal: 1000, supplierCostAtSale: 100 },
    ] as never);
    vi.mocked(prisma.supplierChannel.findMany).mockResolvedValue([
      { id: 1, name: 'Sup1' },
      { id: 2, name: 'Sup2' },
    ] as never);

    const report = await getSupplierReconciliation({ from: '2026-06-01', to: '2026-06-13' });

    expect(report.rows).toHaveLength(2);
    // Sorted by revenue desc → Sup2 first.
    expect(report.rows[0].supplierName).toBe('Sup2');
    const sup1 = report.rows.find((r) => r.supplierId === 1)!;
    expect(sup1.unitsSold).toBe(3);
    expect(sup1.revenue).toBe(300);
    expect(sup1.cost).toBe(180); // 60×2 + 60×1
    expect(sup1.margin).toBe(120);

    const sup2 = report.rows.find((r) => r.supplierId === 2)!;
    expect(sup2.cost).toBe(500); // 100×5

    expect(report.totals.revenue).toBe(1300);
    expect(report.totals.cost).toBe(680);
    expect(report.totals.margin).toBe(620);
  });

  it('treats a null cost snapshot as zero cost (full revenue is margin)', async () => {
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
      { supplierId: 1, quantity: 1, subtotal: 100, supplierCostAtSale: null },
    ] as never);
    vi.mocked(prisma.supplierChannel.findMany).mockResolvedValue([{ id: 1, name: 'S' }] as never);

    const report = await getSupplierReconciliation({ from: '2026-06-01', to: '2026-06-13' });
    expect(report.rows[0].cost).toBe(0);
    expect(report.rows[0].margin).toBe(100);
  });

  it('subtracts recorded payouts from the balance', async () => {
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
      { supplierId: 1, quantity: 2, subtotal: 300, supplierCostAtSale: 60 },
    ] as never);
    vi.mocked(prisma.supplierChannel.findMany).mockResolvedValue([{ id: 1, name: 'S' }] as never);
    vi.mocked(prisma.supplierPayout.findMany).mockResolvedValue([
      { supplierId: 1, amount: 50 },
    ] as never);

    const report = await getSupplierReconciliation({ from: '2026-06-01', to: '2026-06-13' });
    const r = report.rows[0];
    expect(r.cost).toBe(120); // 60×2
    expect(r.paid).toBe(50);
    expect(r.balance).toBe(70); // 120 − 50
    expect(report.totals.paid).toBe(50);
    expect(report.totals.balance).toBe(70);
  });

  it('reports ALL-TIME outstanding independent of the period balance', async () => {
    // Period: cost 120, paid in-window 50 → balance 70.
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
      { supplierId: 1, quantity: 2, subtotal: 300, supplierCostAtSale: 60 },
    ] as never);
    vi.mocked(prisma.supplierChannel.findMany).mockResolvedValue([{ id: 1, name: 'S' }] as never);
    vi.mocked(prisma.supplierPayout.findMany).mockResolvedValue([
      { supplierId: 1, amount: 50 },
    ] as never);
    // All-time: cost owed ever 500, paid ever 400 → outstanding 100.
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ supplier_id: 1, cost: 500 }] as never);
    vi.mocked(prisma.supplierPayout.groupBy).mockResolvedValue([
      { supplierId: 1, _sum: { amount: 400 } },
    ] as never);

    const report = await getSupplierReconciliation({ from: '2026-06-01', to: '2026-06-13' });
    const r = report.rows[0];
    expect(r.balance).toBe(70); // period-only
    expect(r.outstanding).toBe(100); // all-time, 500 − 400
    expect(report.totals.outstanding).toBe(100);
  });

  it('returns empty rows when nothing sold', async () => {
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([] as never);
    const report = await getSupplierReconciliation({ from: '2026-06-01', to: '2026-06-13' });
    expect(report.rows).toHaveLength(0);
    expect(report.totals.revenue).toBe(0);
    expect(prisma.supplierChannel.findMany).not.toHaveBeenCalled();
    expect(prisma.supplierPayout.findMany).not.toHaveBeenCalled();
  });
});

describe('createSupplierPayout', () => {
  it('creates a payout row', async () => {
    vi.mocked(prisma.supplierPayout.create).mockResolvedValue({ id: 9 } as never);
    const res = await createSupplierPayout({
      supplierId: 1,
      amount: 500,
      note: 'червень',
      createdBy: 7,
    });
    expect(res.id).toBe(9);
    expect(prisma.supplierPayout.create).toHaveBeenCalledWith({
      data: {
        supplierId: 1,
        amount: 500,
        note: 'червень',
        createdBy: 7,
        periodFrom: null,
        periodTo: null,
      },
      select: { id: true },
    });
  });
});
