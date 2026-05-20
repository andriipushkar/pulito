import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getAutoSyncSettings,
  saveAutoSyncSettings,
  MARKETPLACE_PLATFORMS,
  type AutoSyncSettings,
  type MarketplacePlatform,
  type SyncInterval,
  type SyncType,
} from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const VALID_INTERVALS: readonly SyncInterval[] = ['off', '1h', '6h', '12h', '24h'];
const VALID_TYPES: readonly SyncType[] = ['products', 'stock', 'orders'];

function isInterval(value: unknown): value is SyncInterval {
  return typeof value === 'string' && (VALID_INTERVALS as readonly string[]).includes(value);
}

function isType(value: string): value is SyncType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const settings = await getAutoSyncSettings();
    return successResponse(settings);
  } catch (err) {
    logger.error('[admin/marketplaces/auto-sync] GET failed', { error: err });
    return errorResponse('Помилка завантаження налаштувань авто-синхронізації', 500);
  }
});

export const PUT = withRole('admin')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return errorResponse('Невалідні дані', 400);
    }

    const sanitized: AutoSyncSettings = {
      olx: {},
      rozetka: {},
      prom: {},
      epicentrk: {},
    };

    for (const platform of MARKETPLACE_PLATFORMS) {
      const platformSettings = (body as Record<string, unknown>)[platform];
      if (!platformSettings || typeof platformSettings !== 'object') continue;
      const entries = Object.entries(platformSettings as Record<string, unknown>);
      for (const [type, interval] of entries) {
        if (!isType(type)) continue;
        if (!isInterval(interval)) continue;
        sanitized[platform as MarketplacePlatform][type] = interval;
      }
    }

    await saveAutoSyncSettings(sanitized);
    return successResponse(sanitized);
  } catch (err) {
    logger.error('[admin/marketplaces/auto-sync] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань авто-синхронізації', 500);
  }
});
