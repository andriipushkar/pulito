import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getCategoryMapping,
  saveCategoryMapping,
  type CategoryMapping,
} from '@/services/marketplace-categories';
import { isMarketplacePlatform } from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Copy category mapping from one platform to another. By default merges with
 * the destination (existing entries are kept); pass overwrite=true to replace.
 *
 * Useful when admin already mapped categories for Rozetka and wants to
 * pre-fill OLX with the same external IDs (often a starting point even though
 * the marketplace IDs are different).
 */
export const POST = withRole('admin')(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as {
      from?: string;
      to?: string;
      overwrite?: boolean;
    };
    if (!body.from || !isMarketplacePlatform(body.from)) {
      return errorResponse('Невалідна вихідна платформа', 400);
    }
    if (!body.to || !isMarketplacePlatform(body.to)) {
      return errorResponse('Невалідна цільова платформа', 400);
    }
    if (body.from === body.to) {
      return errorResponse('Платформи мають відрізнятись', 400);
    }

    const source = await getCategoryMapping(body.from);
    const destination = body.overwrite ? {} : await getCategoryMapping(body.to);

    const merged: CategoryMapping = { ...destination };
    let copied = 0;
    for (const [localId, entry] of Object.entries(source)) {
      if (!body.overwrite && merged[localId]?.externalId) continue;
      merged[localId] = entry;
      copied++;
    }

    await saveCategoryMapping(body.to, merged);

    return successResponse({ copied, total: Object.keys(merged).length });
  } catch (err) {
    logger.error('[admin/marketplaces/categories/copy] POST failed', { error: err });
    return errorResponse('Помилка копіювання', 500);
  }
});
