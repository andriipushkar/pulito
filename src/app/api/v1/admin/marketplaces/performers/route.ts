import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { isMarketplacePlatform } from '@/services/marketplace-health';
import { getPerformers } from '@/services/marketplace-performers';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    if (!platform || !isMarketplacePlatform(platform)) {
      return errorResponse('Невідома платформа', 400);
    }
    const period = searchParams.get('period') || '30d';
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const performers = await getPerformers(platform, from, limit);
    return successResponse(performers);
  } catch (err) {
    logger.error('[admin/marketplaces/performers] GET failed', { error: err });
    return errorResponse(err instanceof Error ? err.message : 'Помилка performers', 500);
  }
});
