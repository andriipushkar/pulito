import { prisma } from '@/lib/prisma';

export interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
  visibility?: 'all' | 'desktop' | 'mobile';
}

// Single source of truth for the homepage layout — the admin route imports
// this same list. Keeping two copies once let the admin omit local_lviv/brands
// (so they couldn't be toggled) while the storefront still rendered them.
export const DEFAULT_BLOCKS: HomepageBlock[] = [
  { key: 'banner_slider', label: 'Банер-слайдер', enabled: true, visibility: 'all' },
  { key: 'local_lviv', label: 'Локальні переваги (Львів)', enabled: true, visibility: 'all' },
  { key: 'categories', label: 'Каталог категорій', enabled: true, visibility: 'all' },
  { key: 'promo_products', label: 'Акційні товари', enabled: true, visibility: 'all' },
  { key: 'new_products', label: 'Новинки', enabled: true, visibility: 'all' },
  { key: 'popular_products', label: 'Хіти продажів', enabled: true, visibility: 'all' },
  { key: 'recently_viewed', label: 'Нещодавно переглянуті', enabled: true, visibility: 'all' },
  { key: 'brands', label: 'Бренди / Торгові марки', enabled: true, visibility: 'all' },
  { key: 'seo_text', label: 'SEO-текстовий блок', enabled: true, visibility: 'all' },
];

function isHomepageBlock(b: unknown): b is HomepageBlock {
  return (
    typeof b === 'object' &&
    b !== null &&
    typeof (b as HomepageBlock).key === 'string' &&
    typeof (b as HomepageBlock).label === 'string' &&
    typeof (b as HomepageBlock).enabled === 'boolean'
  );
}

/**
 * The admin route persists a versioned doc `{ version, blocks }`; rows written
 * before that change are a bare array. Accept BOTH — previously this parsed
 * only the bare array, so once the admin saved (versioned doc) the storefront
 * threw on `.filter`, fell back to DEFAULT_BLOCKS and silently ignored every
 * customization (disabled blocks reappeared, e.g. local_lviv).
 */
export function parseStoredBlocks(rawValue: string): HomepageBlock[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }
  if (Array.isArray(parsed) && parsed.every(isHomepageBlock)) {
    return parsed;
  }
  const blocks = (parsed as { blocks?: unknown })?.blocks;
  if (Array.isArray(blocks) && blocks.every(isHomepageBlock)) {
    return blocks;
  }
  return null;
}

export async function getHomepageBlocks(): Promise<HomepageBlock[]> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_blocks' },
    });

    if (setting) {
      const parsed = parseStoredBlocks(setting.value);
      if (parsed) {
        const cleaned = parsed.filter((b) => b.key !== 'usp');
        // A stored list predates blocks added later in DEFAULT_BLOCKS — merge
        // the missing ones in (at their default position) so new blocks show up
        // without the admin having to re-save the homepage config.
        const storedKeys = new Set(cleaned.map((b) => b.key));
        for (const def of DEFAULT_BLOCKS) {
          if (!storedKeys.has(def.key)) {
            const defIndex = DEFAULT_BLOCKS.indexOf(def);
            cleaned.splice(Math.min(defIndex, cleaned.length), 0, { ...def });
          }
        }
        return cleaned;
      }
    }
  } catch {
    // fall through to default
  }

  return DEFAULT_BLOCKS;
}

export async function getSeoText(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_seo_text' },
    });
    if (setting) return setting.value;
  } catch {
    // fall through
  }
  return '';
}

export async function updateSeoText(text: string, updatedBy?: number): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: 'homepage_seo_text' },
    update: { value: text, updatedBy },
    create: { key: 'homepage_seo_text', value: text, updatedBy },
  });
}
