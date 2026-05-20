import { NextRequest } from 'next/server';
import { importOrdersFromMarketplace } from '@/services/marketplace-sync';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { MARKETPLACE_CHANNELS } from '@/services/marketplaces';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const locked = await withCronLock('marketplace-sync', 1800, async () => {
      const results: Record<
        string,
        { imported: number; skipped: number; failed: number; error?: string }
      > = {};
      // Iterate every supported marketplace — previously olx & epicentrk were
      // silently skipped from cron, so admin had to trigger sync manually.
      for (const platform of MARKETPLACE_CHANNELS) {
        const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
        if (!config?.enabled) continue;
        try {
          results[platform] = await importOrdersFromMarketplace(platform);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('[Cron] Failed to import marketplace orders', { platform, error: message });
          results[platform] = { imported: 0, skipped: 0, failed: -1, error: message };
        }
      }
      return results;
    });

    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous marketplace sync still running' });
    }
    return successResponse(locked.result);
  } catch (err) {
    logger.error('[Cron] sync-marketplace-orders top-level failure', { error: err });
    return errorResponse('Помилка імпорту замовлень', 500);
  }
}
