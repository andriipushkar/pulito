import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { getAllCategoryMappings } from '@/services/marketplace-categories';
import { MARKETPLACE_PLATFORMS } from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export interface CategoryCoverage {
  platform: string;
  totalCategories: number;
  mappedCategories: number;
  totalActiveProducts: number;
  productsWithMapping: number;
  productsWithoutMapping: number;
  uncategorizedProducts: number;
  unmappedCategoryIds: number[];
}

/**
 * Per-platform overview of how complete the category mapping is. Used by the
 * mapping UI to surface "you have N products that will fall back to the
 * default category — they may be rejected by the marketplace".
 */
export const GET = withRole('admin', 'manager')(async () => {
  try {
    const [categories, products, mappings] = await Promise.all([
      prisma.category.findMany({
        where: { isVisible: true, deletedAt: null },
        select: { id: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, categoryId: true },
      }),
      getAllCategoryMappings(),
    ]);

    const productsByCategory = new Map<number, number>();
    let uncategorized = 0;
    for (const p of products) {
      if (p.categoryId == null) {
        uncategorized++;
        continue;
      }
      productsByCategory.set(p.categoryId, (productsByCategory.get(p.categoryId) || 0) + 1);
    }

    const out: CategoryCoverage[] = [];
    for (const platform of MARKETPLACE_PLATFORMS) {
      const map = mappings[platform] || {};
      const mappedIds = new Set(Object.keys(map).map((k) => Number(k)).filter(Number.isFinite));
      let productsWithMapping = 0;
      const unmappedCategoryIds: number[] = [];
      for (const cat of categories) {
        const inCat = productsByCategory.get(cat.id) || 0;
        if (mappedIds.has(cat.id)) productsWithMapping += inCat;
        else if (inCat > 0) unmappedCategoryIds.push(cat.id);
      }
      out.push({
        platform,
        totalCategories: categories.length,
        mappedCategories: Array.from(mappedIds).filter((id) =>
          categories.some((c) => c.id === id),
        ).length,
        totalActiveProducts: products.length,
        productsWithMapping,
        productsWithoutMapping: products.length - uncategorized - productsWithMapping,
        uncategorizedProducts: uncategorized,
        unmappedCategoryIds,
      });
    }

    return successResponse(out);
  } catch (err) {
    logger.error('[admin/marketplaces/categories/coverage] GET failed', { error: err });
    return errorResponse('Помилка завантаження покриття', 500);
  }
});
