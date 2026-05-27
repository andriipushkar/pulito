import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/** Stale-sync threshold — older than this and price drift becomes likely. */
const STALE_DAYS = 7;

/**
 * Pricing-parity report: returns marketplace listings that are likely showing
 * a stale price compared to the site. Two categories:
 *
 *   - error      → last sync failed (lastError set) — price definitely out
 *                  of sync until the underlying error is resolved
 *   - stale      → syncedAt > STALE_DAYS days ago, no recent push attempt
 *
 * Real apples-to-apples price comparison would require calling each marketplace
 * API for the current external price, which is rate-limited and slow. This
 * proxy is good enough to surface "needs attention" listings cheaply.
 */
export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 3600_000);
    const listings = await prisma.marketplaceListing.findMany({
      where: {
        OR: [{ lastError: { not: null } }, { syncedAt: { lt: staleCutoff } }, { syncedAt: null }],
        status: { in: ['active', 'paused'] },
      },
      select: {
        id: true,
        externalId: true,
        externalUrl: true,
        status: true,
        lastError: true,
        syncedAt: true,
        connection: { select: { platform: true } },
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            priceRetail: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ lastError: 'desc' }, { syncedAt: 'asc' }],
      take: 500,
    });

    const rows = listings.map((l) => ({
      id: l.id,
      platform: l.connection.platform,
      productId: l.product.id,
      productCode: l.product.code,
      productName: l.product.name,
      sitePrice: Number(l.product.priceRetail),
      externalId: l.externalId,
      externalUrl: l.externalUrl,
      status: l.status,
      lastError: l.lastError,
      syncedAt: l.syncedAt,
      issue: l.lastError ? 'error' : 'stale',
    }));

    return successResponse({
      total: rows.length,
      withErrors: rows.filter((r) => r.issue === 'error').length,
      stale: rows.filter((r) => r.issue === 'stale').length,
      rows,
    });
  } catch (err) {
    logger.error('[admin/marketplaces/pricing-parity] failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
