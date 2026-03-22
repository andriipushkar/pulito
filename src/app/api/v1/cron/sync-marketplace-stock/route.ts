import { NextRequest } from 'next/server';
import { syncStockToMarketplace } from '@/services/marketplace-sync';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const results: Record<string, { updated: number; failed: number }> = {};

    for (const platform of ['rozetka', 'prom'] as const) {
      try {
        results[platform] = await syncStockToMarketplace(platform);
      } catch (error) {
        console.error(`[Cron] Помилка синхронізації залишків ${platform}:`, error);
        results[platform] = { updated: 0, failed: -1 };
      }
    }

    return successResponse(results);
  } catch {
    return errorResponse('Помилка синхронізації залишків', 500);
  }
}
