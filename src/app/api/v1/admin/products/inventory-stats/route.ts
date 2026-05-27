import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/** Default threshold below which a product counts as "low stock" — tweakable
 * later via SiteSetting if needed. 5 matches typical retail safety stock. */
const LOW_STOCK_THRESHOLD = 5;

/**
 * Returns inventory health metrics for the admin products dashboard:
 *   - totalActive   — active SKUs in the catalog
 *   - outOfStock    — active with quantity = 0
 *   - lowStock      — active with 1 ≤ quantity ≤ LOW_STOCK_THRESHOLD
 *   - lowStockThreshold — echo back so the UI can render "≤ 5" in copy
 *
 * Used by InventoryStatsWidget on /admin/products to flag what needs
 * restocking before the customer sees "out of stock" on the storefront.
 */
export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const [totalActive, outOfStock, lowStock] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, quantity: 0 } }),
      prisma.product.count({
        where: { isActive: true, quantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
      }),
    ]);
    return successResponse({
      totalActive,
      outOfStock,
      lowStock,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    });
  } catch (err) {
    logger.error('[admin/products/inventory-stats] failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
