import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { publishToMarketplace } from '@/services/marketplaces';
import { getChannelConfig } from '@/services/channel-config';
import { MARKETPLACE_PLATFORMS } from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Publishes one or more products to every currently-enabled marketplace
 * with a single POST. Returns per-platform per-product results so the UI
 * can show a progress matrix.
 *
 *   POST /api/v1/admin/marketplaces/cross-list
 *   body: { productIds: number[], platforms?: string[] }  // platforms defaults to all enabled
 */
export const POST = withRole('admin', 'manager')(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as { productIds?: number[]; platforms?: string[] };
    const productIds = (body.productIds || []).filter((n) => Number.isFinite(n));
    if (productIds.length === 0) return errorResponse('Не обрано товарів', 400);

    let targetPlatforms = (body.platforms || []).filter((p) =>
      (MARKETPLACE_PLATFORMS as readonly string[]).includes(p),
    );
    if (targetPlatforms.length === 0) {
      const enabled = await Promise.all(
        MARKETPLACE_PLATFORMS.map(async (p) => ({
          p,
          enabled: (await getChannelConfig(p))?.enabled === true,
        })),
      );
      targetPlatforms = enabled.filter((e) => e.enabled).map((e) => e.p);
    }
    if (targetPlatforms.length === 0) {
      return errorResponse('Жоден маркетплейс не увімкнено', 400);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: {
        content: { select: { fullDescription: true } },
        images: { select: { pathFull: true, pathOriginal: true }, take: 10 },
      },
    });

    const results: Array<{
      productId: number;
      platform: string;
      status: 'published' | 'failed';
      externalId?: string;
      error?: string;
    }> = [];

    for (const product of products) {
      const excluded = Array.isArray(product.excludedMarketplaces)
        ? (product.excludedMarketplaces as string[])
        : [];
      const imageUrls = product.images
        .map((img) => img.pathFull || img.pathOriginal)
        .filter((u): u is string => Boolean(u));

      for (const platform of targetPlatforms) {
        if (excluded.includes(platform)) {
          results.push({
            productId: product.id,
            platform,
            status: 'failed',
            error: 'Excluded by product setting',
          });
          continue;
        }
        const result = await publishToMarketplace(
          platform,
          {
            title: product.name,
            description: product.content?.fullDescription || product.name,
            price: Number(product.priceRetail),
            images: imageUrls,
            productCode: product.code,
            quantity: product.quantity,
            localCategoryId: product.categoryId ?? undefined,
          },
          env.APP_URL,
        );
        results.push({
          productId: product.id,
          platform,
          status: result.status,
          externalId: result.externalId,
          error: result.error,
        });
      }
    }

    const ok = results.filter((r) => r.status === 'published').length;
    return successResponse({
      results,
      summary: { total: results.length, published: ok, failed: results.length - ok },
    });
  } catch (err) {
    logger.error('[admin/marketplaces/cross-list] POST failed', { error: err });
    return errorResponse(err instanceof Error ? err.message : 'Помилка cross-list', 500);
  }
});
