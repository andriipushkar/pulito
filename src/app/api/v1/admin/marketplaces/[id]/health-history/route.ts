import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getHealthHistory,
  computeUptimePercent,
  computeUptimeBuckets,
  computeLatencyPercentiles,
  isMarketplacePlatform,
} from '@/services/marketplace-health';
import { getQuotaInfo } from '@/services/marketplace-quota';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isMarketplacePlatform(id)) return errorResponse('Невідома платформа', 400);
    const history = await getHealthHistory(id);
    const uptime = computeUptimePercent(history);
    const buckets = computeUptimeBuckets(history);
    const latency = computeLatencyPercentiles(history);
    const quota = await getQuotaInfo(id);
    return successResponse({ history, uptime, buckets, latency, quota, count: history.length });
  } catch (err) {
    logger.error('[admin/marketplaces/[id]/health-history] GET failed', { error: err });
    return errorResponse('Помилка завантаження історії', 500);
  }
});
