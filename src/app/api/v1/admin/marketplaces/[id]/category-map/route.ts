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

export const GET = withRole(
  'admin',
  'manager',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isMarketplacePlatform(id)) return errorResponse('Невідома платформа', 400);
    const mapping = await getCategoryMapping(id);
    return successResponse(mapping);
  } catch (err) {
    logger.error('[admin/marketplaces/[id]/category-map] GET failed', { error: err });
    return errorResponse('Помилка завантаження mapping', 500);
  }
});

export const PUT = withRole('admin')(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isMarketplacePlatform(id)) return errorResponse('Невідома платформа', 400);
    const body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') return errorResponse('Невалідні дані', 400);

    const sanitized: CategoryMapping = {};
    for (const [localId, raw] of Object.entries(body)) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      const externalId = typeof entry.externalId === 'string' ? entry.externalId : '';
      const externalName = typeof entry.externalName === 'string' ? entry.externalName : undefined;
      if (externalId.trim().length === 0) continue;
      sanitized[localId] = { externalId, externalName };
    }

    await saveCategoryMapping(id, sanitized);
    return successResponse(sanitized);
  } catch (err) {
    logger.error('[admin/marketplaces/[id]/category-map] PUT failed', { error: err });
    return errorResponse('Помилка збереження mapping', 500);
  }
});
