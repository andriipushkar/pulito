import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import {
  MARKETPLACE_CHANNELS,
  publishToMarketplace,
  validateForMarketplace,
  type MarketplaceListingData,
} from '@/services/marketplaces';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('auto-crosslist');

const SETTINGS_KEY = 'marketplace_auto_crosslist';

export interface AutoCrosslistSettings {
  enabled: boolean;
  /** Only run for active products created within this many days. */
  windowDays: number;
  /** Per-platform override: skip these platforms even if enabled site-wide. */
  excludePlatforms: string[];
}

const DEFAULT_SETTINGS: AutoCrosslistSettings = {
  enabled: false,
  windowDays: 7,
  excludePlatforms: [],
};

export async function getAutoCrosslistSettings(): Promise<AutoCrosslistSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row?.value) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<AutoCrosslistSettings>;
    return {
      enabled: parsed.enabled === true,
      windowDays: Number(parsed.windowDays) > 0 ? Number(parsed.windowDays) : DEFAULT_SETTINGS.windowDays,
      excludePlatforms: Array.isArray(parsed.excludePlatforms) ? parsed.excludePlatforms : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAutoCrosslistSettings(s: AutoCrosslistSettings): Promise<void> {
  const cleaned: AutoCrosslistSettings = {
    enabled: !!s.enabled,
    windowDays: Math.max(1, Math.min(90, Math.floor(Number(s.windowDays) || DEFAULT_SETTINGS.windowDays))),
    excludePlatforms: (s.excludePlatforms || []).filter((p) =>
      (MARKETPLACE_CHANNELS as readonly string[]).includes(p),
    ),
  };
  await prisma.siteSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(cleaned) },
    update: { value: JSON.stringify(cleaned) },
  });
}

interface CrosslistReport {
  scanned: number;
  published: number;
  skipped: number;
  errors: number;
  perPlatform: Record<string, { published: number; skipped: number; errors: number }>;
}

/**
 * For each active product created in the recent window, publish it to every
 * enabled marketplace where it's not already published and not excluded.
 *
 * Idempotent: silently skips products that already have a PublicationChannel
 * row for the platform with status='published'.
 */
export async function runAutoCrosslist(): Promise<CrosslistReport> {
  const settings = await getAutoCrosslistSettings();
  const report: CrosslistReport = {
    scanned: 0,
    published: 0,
    skipped: 0,
    errors: 0,
    perPlatform: {},
  };

  if (!settings.enabled) {
    log.info('Auto-crosslist disabled — skipping');
    return report;
  }

  const since = new Date(Date.now() - settings.windowDays * 24 * 60 * 60 * 1000);

  // Eligible platforms = configured AND not in excludePlatforms.
  const eligiblePlatforms: string[] = [];
  for (const platform of MARKETPLACE_CHANNELS) {
    if (settings.excludePlatforms.includes(platform)) continue;
    const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
    if (config?.enabled) eligiblePlatforms.push(platform);
    report.perPlatform[platform] = { published: 0, skipped: 0, errors: 0 };
  }

  if (eligiblePlatforms.length === 0) {
    log.info('No eligible platforms — skipping');
    return report;
  }

  // Publication.createdBy is required — find any admin to attribute the auto-publication to.
  const systemAdmin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (!systemAdmin) {
    log.warn('No admin user found to attribute auto-publications — aborting');
    return report;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true, createdAt: { gte: since } },
    include: {
      content: { select: { fullDescription: true } },
      images: {
        select: { pathFull: true, pathOriginal: true, pathMedium: true },
        orderBy: { sortOrder: 'asc' },
        take: 12,
      },
      publications: {
        select: {
          channels: true,
          status: true,
          channelResults: { select: { channel: true, status: true } },
        },
      },
    },
  });
  report.scanned = products.length;

  for (const product of products) {
    const alreadyPublished = new Set<string>();
    for (const pub of product.publications) {
      for (const cr of pub.channelResults) {
        if (cr.status === 'published') alreadyPublished.add(cr.channel);
      }
    }
    const excluded = Array.isArray(product.excludedMarketplaces)
      ? (product.excludedMarketplaces as string[])
      : [];

    const imageUrls = product.images
      .map((img) => img.pathFull || img.pathOriginal || img.pathMedium)
      .filter((u): u is string => Boolean(u));

    const data: MarketplaceListingData = {
      title: product.name,
      description: product.content?.fullDescription || product.name,
      price: Number(product.priceRetail),
      images: imageUrls,
      productCode: product.code,
      quantity: product.quantity,
      localCategoryId: product.categoryId ?? undefined,
    };

    for (const platform of eligiblePlatforms) {
      if (alreadyPublished.has(platform)) {
        report.skipped++;
        report.perPlatform[platform].skipped++;
        continue;
      }
      if (excluded.includes(platform)) {
        report.skipped++;
        report.perPlatform[platform].skipped++;
        continue;
      }

      const validation = validateForMarketplace(platform, data);
      if (!validation.valid) {
        report.errors++;
        report.perPlatform[platform].errors++;
        log.warn('Auto-crosslist validation failed', {
          platform,
          productId: product.id,
          errors: validation.errors,
        });
        continue;
      }

      try {
        const result = await publishToMarketplace(platform, data, env.APP_URL);
        if (result.status === 'published' && result.externalId) {
          await prisma.publication.create({
            data: {
              title: product.name,
              content: data.description,
              productId: product.id,
              channels: [platform],
              status: 'published',
              publishedAt: new Date(),
              createdBy: systemAdmin.id,
              channelResults: {
                create: {
                  channel: platform,
                  status: 'published',
                  externalId: result.externalId,
                  permalink: result.permalink || null,
                  publishedAt: new Date(),
                },
              },
            },
          });
          report.published++;
          report.perPlatform[platform].published++;
        } else {
          report.errors++;
          report.perPlatform[platform].errors++;
          log.warn('Auto-crosslist publish returned non-published', {
            platform,
            productId: product.id,
            error: result.error,
          });
        }
      } catch (err) {
        report.errors++;
        report.perPlatform[platform].errors++;
        log.error('Auto-crosslist publish threw', {
          platform,
          productId: product.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return report;
}
