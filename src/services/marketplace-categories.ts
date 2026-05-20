import { prisma } from '@/lib/prisma';
import { MARKETPLACE_PLATFORMS, type MarketplacePlatform } from '@/services/marketplace-health';

export interface CategoryMappingEntry {
  externalId: string;
  externalName?: string;
}

export type CategoryMapping = Record<string, CategoryMappingEntry>; // local category id → entry

const KEY = (platform: string) => `marketplace_category_map_${platform}`;

export async function getCategoryMapping(
  platform: MarketplacePlatform,
): Promise<CategoryMapping> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: KEY(platform) } });
  if (!setting?.value) return {};
  try {
    return JSON.parse(setting.value) as CategoryMapping;
  } catch {
    return {};
  }
}

export async function getAllCategoryMappings(): Promise<
  Record<MarketplacePlatform, CategoryMapping>
> {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: MARKETPLACE_PLATFORMS.map((p) => KEY(p)) } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const out = {} as Record<MarketplacePlatform, CategoryMapping>;
  for (const platform of MARKETPLACE_PLATFORMS) {
    const raw = map.get(KEY(platform));
    if (raw) {
      try {
        out[platform] = JSON.parse(raw) as CategoryMapping;
        continue;
      } catch {
        /* fall through */
      }
    }
    out[platform] = {};
  }
  return out;
}

export async function saveCategoryMapping(
  platform: MarketplacePlatform,
  mapping: CategoryMapping,
): Promise<void> {
  // Strip entries with empty externalId so storage stays clean
  const cleaned: CategoryMapping = {};
  for (const [localId, entry] of Object.entries(mapping)) {
    if (entry?.externalId && entry.externalId.trim().length > 0) {
      cleaned[localId] = {
        externalId: entry.externalId.trim(),
        externalName: entry.externalName?.trim() || undefined,
      };
    }
  }
  const value = JSON.stringify(cleaned);
  await prisma.siteSetting.upsert({
    where: { key: KEY(platform) },
    create: { key: KEY(platform), value },
    update: { value },
  });
}

/**
 * Resolves the external category ID for a given local category on a marketplace.
 * Returns null if no mapping exists — caller can fall back to a platform default.
 */
export async function resolveExternalCategory(
  platform: MarketplacePlatform,
  localCategoryId: number | null | undefined,
): Promise<string | null> {
  if (localCategoryId == null) return null;
  const mapping = await getCategoryMapping(platform);
  return mapping[String(localCategoryId)]?.externalId || null;
}
