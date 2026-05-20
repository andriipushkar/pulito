import { prisma } from '@/lib/prisma';
import type {
  TenantBilling,
  BillingInvoice,
  Plan,
} from '../../generated/prisma';

export class BillingError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'BillingError';
    this.statusCode = statusCode;
  }
}

/**
 * Create billing record for a tenant with trial status.
 */
export async function createBillingForTenant(
  tenantId: number,
  planId: number
): Promise<TenantBilling> {
  const existing = await prisma.tenantBilling.findUnique({
    where: { tenantId },
  });

  if (existing) {
    throw new BillingError('Біллінг для цього тенанта вже існує');
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new BillingError('План не знайдено', 404);
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  return prisma.tenantBilling.create({
    data: {
      tenantId,
      planId,
      status: 'trial',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
    },
  });
}

/**
 * Get billing info for a tenant including plan details.
 */
export async function getBilling(
  tenantId: number
): Promise<TenantBilling & { plan: Plan }> {
  const billing = await prisma.tenantBilling.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  if (!billing) {
    throw new BillingError('Біллінг не знайдено', 404);
  }

  return billing;
}

/**
 * Change plan for a tenant.
 */
export async function changePlan(
  tenantId: number,
  newPlanId: number
): Promise<TenantBilling> {
  // Read + write in one tx so a concurrent markInvoicePaid (or another admin
  // changing the plan) can't observe a partial state where the plan changed
  // but the period reset hasn't happened yet.
  return prisma.$transaction(async (tx) => {
    const billing = await tx.tenantBilling.findUnique({ where: { tenantId } });
    if (!billing) throw new BillingError('Біллінг не знайдено', 404);

    const plan = await tx.plan.findUnique({ where: { id: newPlanId } });
    if (!plan) throw new BillingError('План не знайдено', 404);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return tx.tenantBilling.update({
      where: { tenantId },
      data: {
        planId: newPlanId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  });
}

/**
 * Create an invoice for a billing period.
 */
export async function createInvoice(
  billingId: number
): Promise<BillingInvoice> {
  const billing = await prisma.tenantBilling.findUnique({
    where: { id: billingId },
    include: { plan: true },
  });

  if (!billing) {
    throw new BillingError('Біллінг не знайдено', 404);
  }

  return prisma.billingInvoice.create({
    data: {
      billingId,
      amount: billing.plan.priceMonthly,
      currency: 'UAH',
      status: 'draft',
      periodStart: billing.currentPeriodStart,
      periodEnd: billing.currentPeriodEnd,
    },
  });
}

/**
 * Mark an invoice as paid.
 */
export async function markInvoicePaid(
  invoiceId: number
): Promise<BillingInvoice> {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new BillingError('Рахунок не знайдено', 404);
  }

  return prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
    },
  });
}

/**
 * Check usage limits for a tenant against their plan.
 */
export async function checkUsageLimits(
  tenantId: number
): Promise<{
  products: { used: number; max: number };
  orders: { used: number; max: number };
}> {
  const billing = await prisma.tenantBilling.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  if (!billing) {
    throw new BillingError('Біллінг не знайдено', 404);
  }

  const [productCount, orderCount] = await Promise.all([
    prisma.product.count(),
    prisma.order.count({
      where: {
        createdAt: {
          gte: billing.currentPeriodStart,
          lte: billing.currentPeriodEnd,
        },
      },
    }),
  ]);

  return {
    products: { used: productCount, max: billing.plan.maxProducts },
    orders: { used: orderCount, max: billing.plan.maxOrders },
  };
}

/**
 * Record a usage metric for a tenant.
 */
export async function recordUsage(
  tenantId: number,
  metric: string,
  value: number
): Promise<void> {
  await prisma.usageRecord.create({
    data: {
      tenantId,
      metric,
      value,
    },
  });
}

/**
 * Get all active plans.
 */
export async function getPlans(): Promise<Plan[]> {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: 'asc' },
  });
}
