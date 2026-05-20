import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { archiveListing } from '@/services/marketplace-listing-archive';
import { successResponse, errorResponse } from '@/utils/api-response';
import { MARKETPLACE_PLATFORMS } from '@/services/marketplace-health';
import { logger } from '@/lib/logger';

/**
 * Bulk-archive marketplace listings by filter.
 *
 *   POST /api/v1/admin/marketplaces/listings/bulk-delete
 *   body: {
 *     platform?: string,    // restrict to single platform
 *     categoryId?: number,  // restrict to local category
 *     productIds?: number[], // explicit set of products
 *     status?: 'published'|'failed'|'paused',
 *     confirm?: boolean,    // when false, returns count without deleting
 *   }
 */
export const POST = withRole('admin')(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as {
      platform?: string;
      categoryId?: number;
      productIds?: number[];
      status?: string;
      confirm?: boolean;
    };

    const where: Record<string, unknown> = {
      channel: { in: MARKETPLACE_PLATFORMS as readonly string[] as string[] },
    };
    if (body.platform && (MARKETPLACE_PLATFORMS as readonly string[]).includes(body.platform)) {
      where.channel = body.platform;
    }
    if (body.status) where.status = body.status;
    if (body.categoryId != null || (body.productIds && body.productIds.length > 0)) {
      const pubFilter: Record<string, unknown> = {};
      if (body.categoryId != null) pubFilter.product = { categoryId: body.categoryId };
      if (body.productIds && body.productIds.length > 0) pubFilter.productId = { in: body.productIds };
      where.publication = pubFilter;
    }

    const count = await prisma.publicationChannel.count({ where });

    if (!body.confirm) {
      return successResponse({ wouldArchive: count, archived: 0, dryRun: true });
    }

    const targets = await prisma.publicationChannel.findMany({
      where,
      select: { id: true },
      take: 1000,
    });
    let archived = 0;
    for (const t of targets) {
      try {
        await archiveListing(t.id);
        archived++;
      } catch {
        // continue on individual failures
      }
    }

    return successResponse({ wouldArchive: count, archived, dryRun: false });
  } catch (err) {
    logger.error('[admin/marketplaces/listings/bulk-delete] POST failed', { error: err });
    return errorResponse(err instanceof Error ? err.message : 'Помилка bulk-delete', 500);
  }
});
