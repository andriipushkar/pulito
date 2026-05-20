import { withRole } from '@/middleware/auth';
import { getConnectionStatus } from '@/services/marketplace-sync';
import {
  MARKETPLACE_PLATFORMS,
  getAllHealthStatuses,
  type MarketplacePlatform,
} from '@/services/marketplace-health';
import { getAllRateUsage } from '@/services/marketplace-rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const [statuses, health] = await Promise.all([
      Promise.all(
        MARKETPLACE_PLATFORMS.map(async (platform: MarketplacePlatform) => {
          try {
            return await getConnectionStatus(platform);
          } catch {
            return {
              connected: false,
              platform,
              lastSyncProducts: null,
              lastSyncStock: null,
              lastSyncOrders: null,
              publishedCount: 0,
            };
          }
        }),
      ),
      getAllHealthStatuses(),
    ]);

    const rateUsage = await getAllRateUsage();
    const enriched = statuses.map((s) => ({
      ...s,
      health: health[s.platform as MarketplacePlatform] || null,
      rateUsage: rateUsage[s.platform as MarketplacePlatform] || null,
    }));

    return successResponse(enriched);
  } catch (err) {
    logger.error('[admin/marketplaces] GET failed', { error: err });
    return errorResponse('Помилка завантаження підключень маркетплейсів', 500);
  }
});
