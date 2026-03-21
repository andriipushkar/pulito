import { prisma } from '@/lib/prisma';

const RETENTION_DAYS = 90;

/**
 * Permanently delete soft-deleted Category and Product records
 * that have been in the trash for more than 90 days.
 */
export async function cleanupSoftDeleted(): Promise<{ categories: number; products: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

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

  return { categories: categories.count, products: products.count };
}
