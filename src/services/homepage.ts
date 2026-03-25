import { prisma } from '@/lib/prisma';

export interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
}

export interface USPItem {
  icon: string;
  title: string;
  description: string;
}

const DEFAULT_BLOCKS: HomepageBlock[] = [
  { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
  { key: 'usp', label: 'Блок переваг (USP)', enabled: true },
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
      return JSON.parse(setting.value);
    }
  } catch {
    // fall through to default
  }

  return DEFAULT_BLOCKS;
}

const DEFAULT_USP_ITEMS: USPItem[] = [
  { icon: 'truck', title: 'Швидка доставка', description: 'По всій Україні за 1-3 дні' },
  { icon: 'shield', title: 'Гарантія якості', description: 'Тільки оригінальна продукція' },
  { icon: 'money', title: 'Оптові ціни', description: 'Знижки для оптових покупців' },
  { icon: 'phone', title: 'Підтримка', description: 'Консультація Пн-Пт 9-18' },
];

export async function getUSPItems(): Promise<USPItem[]> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_usp_items' },
    });
    if (setting) return JSON.parse(setting.value);
  } catch {
    // fall through
  }
  return DEFAULT_USP_ITEMS;
}

export async function updateUSPItems(items: USPItem[], updatedBy?: number): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: 'homepage_usp_items' },
    update: { value: JSON.stringify(items), updatedBy },
    create: { key: 'homepage_usp_items', value: JSON.stringify(items), updatedBy },
  });
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
