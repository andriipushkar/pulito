import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { computeRevenueDashboard } from '@/services/marketplace-revenue-stats';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    else if (period === '365d') days = 365;

    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const dashboard = await computeRevenueDashboard(from, to);
    return successResponse(dashboard);
  } catch (err) {
    logger.error('[admin/marketplaces/revenue] GET failed', { error: err });
    return errorResponse(err instanceof Error ? err.message : 'Помилка revenue', 500);
  }
});
