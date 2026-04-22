import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

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

const SETTING_KEY = 'homepage_blocks';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (setting) {
      const blocks: HomepageBlock[] = JSON.parse(setting.value);
      return successResponse(blocks);
    }

    return successResponse(DEFAULT_BLOCKS);
  } catch {
    return errorResponse('Помилка завантаження блоків', 500);
  }
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const blocks: HomepageBlock[] = await request.json();

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return errorResponse('Невалідний формат даних', 400);
    }

    const value = JSON.stringify(blocks);

    await prisma.siteSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value },
      create: { key: SETTING_KEY, value },
    });

    return successResponse({ updated: true });
  } catch {
    return errorResponse('Помилка збереження блоків', 500);
  }
});
