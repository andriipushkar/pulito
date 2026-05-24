import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
  // Future-proofing: optional fields appended to the stored shape over time.
  // Default to undefined; the migration helper below fills sensible values
  // so old rows don't need a one-off backfill.
  visibility?: 'all' | 'desktop' | 'mobile';
}

// Schema version stored alongside blocks so we can migrate the JSON in
// place when the shape changes. Bump this whenever HomepageBlock gains a
// new field that needs a fill-in default.
export const HOMEPAGE_BLOCKS_VERSION = 1;

interface HomepageBlocksDoc {
  version: number;
  blocks: HomepageBlock[];
}

const DEFAULT_BLOCKS: HomepageBlock[] = [
  { key: 'banner_slider', label: 'Банер-слайдер', enabled: true, visibility: 'all' },
  { key: 'categories', label: 'Каталог категорій', enabled: true, visibility: 'all' },
  { key: 'promo_products', label: 'Акційні товари', enabled: true, visibility: 'all' },
  { key: 'new_products', label: 'Новинки', enabled: true, visibility: 'all' },
  { key: 'popular_products', label: 'Хіти продажів', enabled: true, visibility: 'all' },
  { key: 'recently_viewed', label: 'Нещодавно переглянуті', enabled: true, visibility: 'all' },
  { key: 'seo_text', label: 'SEO-текстовий блок', enabled: true, visibility: 'all' },
];

const SETTING_KEY = 'homepage_blocks';

function isHomepageBlock(b: unknown): b is HomepageBlock {
  return (
    typeof b === 'object' &&
    b !== null &&
    typeof (b as HomepageBlock).key === 'string' &&
    typeof (b as HomepageBlock).label === 'string' &&
    typeof (b as HomepageBlock).enabled === 'boolean'
  );
}

/** Migrate a parsed stored value (which may be a legacy array or a versioned
 *  doc) to the current shape. Fills in defaults for newly-added fields so
 *  the storefront never reads `undefined` on a known key. */
function migrateBlocks(parsed: unknown): HomepageBlock[] | null {
  // Legacy: stored value was a bare array. Wrap + fill defaults.
  if (Array.isArray(parsed) && parsed.every(isHomepageBlock)) {
    return (parsed as HomepageBlock[]).map((b) => ({
      visibility: 'all',
      ...b,
    }));
  }
  // Versioned doc.
  if (
    parsed &&
    typeof parsed === 'object' &&
    'version' in parsed &&
    'blocks' in parsed &&
    Array.isArray((parsed as HomepageBlocksDoc).blocks) &&
    (parsed as HomepageBlocksDoc).blocks.every(isHomepageBlock)
  ) {
    const doc = parsed as HomepageBlocksDoc;
    return doc.blocks.map((b) => ({ visibility: 'all', ...b }));
  }
  return null;
}

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (setting) {
      try {
        const parsed: unknown = JSON.parse(setting.value);
        const migrated = migrateBlocks(parsed);
        if (migrated) return successResponse(migrated);
        logger.warn('[admin/homepage-blocks] stored value malformed, falling back to defaults');
      } catch (parseErr) {
        logger.warn('[admin/homepage-blocks] JSON.parse failed, falling back to defaults', {
          error: parseErr,
        });
      }
    }

    return successResponse(DEFAULT_BLOCKS);
  } catch (err) {
    logger.error('[admin/homepage-blocks] GET failed', { error: err });
    return errorResponse('Помилка завантаження блоків', 500);
  }
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const blocks: unknown = await request.json();

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return errorResponse('Невалідний формат даних', 400);
    }
    if (!blocks.every(isHomepageBlock)) {
      return errorResponse('Кожен блок має мати key, label та enabled', 400);
    }

    // Always write the versioned doc shape so subsequent reads go through
    // the same migration path (no special-casing for "fresh" data).
    const doc: HomepageBlocksDoc = { version: HOMEPAGE_BLOCKS_VERSION, blocks };
    const value = JSON.stringify(doc);

    await prisma.siteSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value, updatedBy: user.id },
      create: { key: SETTING_KEY, value, updatedBy: user.id },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'homepage_blocks',
      details: { blockCount: blocks.length },
    });
    // Homepage layout changed — bust the ISR cache so the storefront
    // reflects the new block order/visibility immediately.
    revalidatePath('/');

    return successResponse({ updated: true });
  } catch (err) {
    logger.error('[admin/homepage-blocks] PUT failed', { error: err });
    return errorResponse('Помилка збереження блоків', 500);
  }
});
