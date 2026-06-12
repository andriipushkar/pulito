import { prisma } from '@/lib/prisma';

export interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_BLOCKS: HomepageBlock[] = [
  { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
  { key: 'local_lviv', label: 'Локальні переваги (Львів)', enabled: true },
  { key: 'categories', label: 'Каталог категорій', enabled: true },
  { key: 'promo_products', label: 'Акційні товари', enabled: true },
  { key: 'new_products', label: 'Новинки', enabled: true },
  { key: 'popular_products', label: 'Хіти продажів', enabled: true },
  { key: 'recently_viewed', label: 'Нещодавно переглянуті', enabled: true },
  { key: 'brands', label: 'Бренди / Торгові марки', enabled: true },
  { key: 'seo_text', label: 'SEO-текстовий блок', enabled: true },
];

export async function getHomepageBlocks(): Promise<HomepageBlock[]> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_blocks' },
    });

    if (setting) {
      const stored: HomepageBlock[] = JSON.parse(setting.value);
      const cleaned = stored.filter((b) => b.key !== 'usp');
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
