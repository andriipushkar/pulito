import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  tenantBilling: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  plan: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  billingInvoice: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  usageRecord: {
    create: vi.fn(),
  },
  product: {
    count: vi.fn(),
  },
  order: {
    count: vi.fn(),
  },
  $transaction: vi.fn(async (arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mockPrisma) : undefined,
  ),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  createBillingForTenant,
  changePlan,
  checkUsageLimits,
  createInvoice,
  markInvoicePaid,
  getPlans,
  recordUsage,
} from './billing';

describe('billing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBillingForTenant', () => {
    it('creates billing with trial status', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue(null);
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 1, name: 'Basic' });
      const created = {
        id: 1,
        tenantId: 1,
        planId: 1,
        status: 'trial',
        trialEndsAt: expect.any(Date),
      };
      mockPrisma.tenantBilling.create.mockResolvedValue(created);

      const result = await createBillingForTenant(1, 1);

      expect(result.status).toBe('trial');
      expect(mockPrisma.tenantBilling.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 1,
          planId: 1,
          status: 'trial',
          trialEndsAt: expect.any(Date),
        }),
      });
    });

    it('throws if billing already exists', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue({ id: 1 });

      await expect(createBillingForTenant(1, 1)).rejects.toThrow(
        'Біллінг для цього тенанта вже існує',
      );
    });
  });

  describe('changePlan', () => {
    it('updates plan reference', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue({
        id: 1,
        tenantId: 1,
        planId: 1,
        status: 'active',
        proratedCredit: 0,
        // Proration reads the current period bounds (Date objects).
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
        plan: { priceMonthly: 100 },
      });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 2, name: 'Pro', priceMonthly: 200 });
      mockPrisma.tenantBilling.update.mockResolvedValue({
        id: 1,
        tenantId: 1,
        planId: 2,
        status: 'active',
      });

      const result = await changePlan(1, 2);

      expect(result.planId).toBe(2);
      expect(result.status).toBe('active');
      expect(mockPrisma.tenantBilling.update).toHaveBeenCalledWith({
        where: { tenantId: 1 },
        data: expect.objectContaining({
          planId: 2,
          status: 'active',
        }),
      });
    });

    it('throws if plan not found', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(changePlan(1, 999)).rejects.toThrow('План не знайдено');
    });
  });

  describe('checkUsageLimits', () => {
    it('returns correct used/max values', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue({
        id: 1,
        tenantId: 1,
        plan: { maxProducts: 100, maxOrders: 500 },
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      });
      mockPrisma.product.count.mockResolvedValue(45);
      mockPrisma.order.count.mockResolvedValue(120);

      const result = await checkUsageLimits(1);

      expect(result.products).toEqual({ used: 45, max: 100 });
      expect(result.orders).toEqual({ used: 120, max: 500 });
    });

    it('throws if billing not found', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue(null);

      await expect(checkUsageLimits(1)).rejects.toThrow('Біллінг не знайдено');
    });
  });

  describe('createInvoice', () => {
    it('generates invoice with correct amount from plan price', async () => {
      mockPrisma.tenantBilling.findUnique.mockResolvedValue({
        id: 1,
        plan: { priceMonthly: 499 },
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      });
      const created = {
        id: 1,
        billingId: 1,
        amount: 499,
        currency: 'UAH',
        status: 'draft',
      };
      mockPrisma.billingInvoice.create.mockResolvedValue(created);

      const result = await createInvoice(1);

      expect(result.amount).toBe(499);
      expect(result.currency).toBe('UAH');
      expect(mockPrisma.billingInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          billingId: 1,
          amount: 499,
          currency: 'UAH',
          status: 'draft',
        }),
      });
    });
  });

  describe('markInvoicePaid', () => {
    it('updates invoice status to paid', async () => {
      mockPrisma.billingInvoice.findUnique.mockResolvedValue({ id: 1, status: 'sent' });
      mockPrisma.billingInvoice.update.mockResolvedValue({
        id: 1,
        status: 'paid',
        paidAt: expect.any(Date),
      });

      const result = await markInvoicePaid(1);

      expect(result.status).toBe('paid');
    });
  });

  describe('getPlans', () => {
    it('returns active plans sorted by price', async () => {
      const plans = [
        { id: 1, slug: 'basic', priceMonthly: 199 },
        { id: 2, slug: 'pro', priceMonthly: 499 },
      ];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await getPlans();

      expect(result).toHaveLength(2);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });
    });
  });

  describe('recordUsage', () => {
    it('creates a usage record', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue({});

      await recordUsage(1, 'products', 50);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: { tenantId: 1, metric: 'products', value: 50 },
      });
    });
  });
});
