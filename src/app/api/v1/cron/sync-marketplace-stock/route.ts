import { NextRequest } from 'next/server';
import { syncStockToMarketplace } from '@/services/marketplace-sync';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { withCronLock } from '@/lib/cron-lock';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const locked = await withCronLock('marketplace-sync', 1800, async () => {
      const results: Record<string, { updated: number; failed: number }> = {};
      for (const platform of ['rozetka', 'prom'] as const) {
        try {
          results[platform] = await syncStockToMarketplace(platform);
        } catch (error) {
          console.error(`[Cron] Помилка синхронізації залишків ${platform}:`, error);
          results[platform] = { updated: 0, failed: -1 };
        }
      }
      return results;
    });

    if (!locked.acquired) {
      return successResponse({ skipped: true, reason: 'Previous marketplace sync still running' });
    }
    return successResponse(locked.result);
  } catch {
    return errorResponse('Помилка синхронізації залишків', 500);
  }
}
