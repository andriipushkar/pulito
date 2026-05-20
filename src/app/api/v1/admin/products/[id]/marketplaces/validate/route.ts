import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  validateForMarketplace,
  type MarketplaceListingData,
} from '@/services/marketplaces';
import { isMarketplacePlatform, MARKETPLACE_PLATFORMS } from '@/services/marketplace-health';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { resolveExternalCategory } from '@/services/marketplace-categories';
import { logger } from '@/lib/logger';

// Per-platform minimum image side (mirrors POLICY in marketplace-image-pipeline.ts).
// Kept as a small local map so this endpoint doesn't need to bundle sharp.
const IMAGE_MIN_SIDE: Record<string, number> = {
  olx: 800,
  rozetka: 1000,
  prom: 1000,
  epicentrk: 1000,
};

export interface PerPlatformValidation {
  platform: string;
  configured: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
  categoryStatus: 'mapped' | 'fallback' | 'missing';
  smallImages: number;
}

/**
 * Dry-run publish validation: tells the admin what would fail or warn before
 * actually hitting the marketplace. Runs for every platform in one call so
 * the UI can render a checklist per product.
 */
export const POST = withRole('admin', 'manager')(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const productId = Number(id);
      if (!Number.isFinite(productId)) return errorResponse('Невалідний ID', 400);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          content: { select: { fullDescription: true } },
          images: {
            select: {
              pathFull: true,
              pathOriginal: true,
              pathMedium: true,
              width: true,
              height: true,
            },
            orderBy: { sortOrder: 'asc' },
            take: 12,
          },
        },
      });
      if (!product) return errorResponse('Товар не знайдено', 404);

      const imageUrls = product.images
        .map((img) => img.pathFull || img.pathOriginal || img.pathMedium)
        .filter((u): u is string => Boolean(u));

      const baseData: MarketplaceListingData = {
        title: product.name,
        description: product.content?.fullDescription || product.name,
        price: Number(product.priceRetail),
        images: imageUrls,
        productCode: product.code,
        quantity: product.quantity,
        localCategoryId: product.categoryId ?? undefined,
      };

      const excluded = Array.isArray(product.excludedMarketplaces)
        ? (product.excludedMarketplaces as string[])
        : [];

      const out: PerPlatformValidation[] = [];
      for (const platform of MARKETPLACE_PLATFORMS) {
        if (!isMarketplacePlatform(platform)) continue;
        const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
        const configured = !!config?.enabled;
        const baseValidation = validateForMarketplace(platform, baseData);
        const errors = [...baseValidation.errors];
        const warnings = [...baseValidation.warnings];

        if (excluded.includes(platform)) {
          warnings.push('Товар виключено з цього маркетплейсу');
        }

        // Category resolution status.
        let categoryStatus: 'mapped' | 'fallback' | 'missing' = 'missing';
        if (product.categoryId != null) {
          const external = await resolveExternalCategory(platform, product.categoryId);
          if (external) {
            categoryStatus = 'mapped';
          } else if (config?.defaultCategoryId) {
            categoryStatus = 'fallback';
            warnings.push(
              `Категорія не замаплена — впаде у дефолтну (${config.defaultCategoryId})`,
            );
          } else {
            errors.push('Категорія не замаплена і немає defaultCategoryId — публікація відмовить');
          }
        }

        // Image dimension check (uses DB-stored width/height, not network).
        const minSide = IMAGE_MIN_SIDE[platform] ?? 0;
        let smallImages = 0;
        for (const img of product.images) {
          const w = img.width ?? 0;
          const h = img.height ?? 0;
          if ((w && w < minSide) || (h && h < minSide)) smallImages++;
        }
        if (smallImages > 0) {
          warnings.push(
            `${smallImages} фото менше ${minSide}px — буде апскейл, якість може впасти`,
          );
        }

        out.push({
          platform,
          configured,
          valid: configured && errors.length === 0 && !excluded.includes(platform),
          errors,
          warnings,
          categoryStatus,
          smallImages,
        });
      }

      return successResponse(out);
    } catch (err) {
      logger.error('[admin/products/[id]/marketplaces/validate] POST failed', { error: err });
      return errorResponse('Помилка валідації', 500);
    }
  },
);
