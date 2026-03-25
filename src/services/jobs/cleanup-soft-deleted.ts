import { prisma } from '@/lib/prisma';

const RETENTION_DAYS = 90;
// Financial records (orders, payments) are retained longer for tax/legal compliance
const FINANCIAL_RETENTION_DAYS = 365;

interface CleanupResult {
  categories: number;
  products: number;
  orders: number;
  users: number;
  payments: number;
}

/**
 * Permanently delete soft-deleted records that have been
 * in the trash beyond the retention period.
 *
 * Financial records (orders, payments) have a longer retention
 * period (365 days) for tax/legal compliance.
 */
export async function cleanupSoftDeleted(): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const financialCutoff = new Date(Date.now() - FINANCIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Products first (may have FK to categories)
  const products = await prisma.product.deleteMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
    },
  });

  const categories = await prisma.category.deleteMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
    },
  });

  // Financial records with longer retention
  const payments = await prisma.payment.deleteMany({
    where: {
      deletedAt: { not: null, lt: financialCutoff },
    },
  });

  const orders = await prisma.order.deleteMany({
    where: {
      deletedAt: { not: null, lt: financialCutoff },
    },
  });

  const users = await prisma.user.deleteMany({
    where: {
      deletedAt: { not: null, lt: financialCutoff },
    },
  });

  return {
    categories: categories.count,
    products: products.count,
    orders: orders.count,
    users: users.count,
    payments: payments.count,
  };
}
