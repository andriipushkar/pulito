import { prisma } from '@/lib/prisma';

export interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_BLOCKS: HomepageBlock[] = [
  { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
  { key: 'categories', label: 'Каталог категорій', enabled: true },
  { key: 'promo_products', label: 'Акційні товари', enabled: true },
  { key: 'new_products', label: 'Новинки', enabled: true },
  { key: 'popular_products', label: 'Хіти продажів', enabled: true },
  { key: 'recently_viewed', label: 'Нещодавно переглянуті', enabled: true },
  { key: 'brands', label: 'Бренди / Виробники', enabled: true },
  { key: 'seo_text', label: 'SEO-текстовий блок', enabled: true },
];

export async function getHomepageBlocks(): Promise<HomepageBlock[]> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_blocks' },
    });

    if (setting) {
      const stored: HomepageBlock[] = JSON.parse(setting.value);
      return stored.filter((b) => b.key !== 'usp');
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
