import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

// 404 logs are deduped by path (count++ per hit), so the table grows by the
// number of DISTINCT missing paths — bot probes, dead links and typos
// accumulate forever otherwise. Purge paths not seen in RETENTION_DAYS; a path
// that recurs simply gets re-created on the next hit.
const RETENTION_DAYS = 90;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.CRON_SECRET || env.APP_SECRET}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const deleted = await prisma.notFoundLog.deleteMany({
      where: { lastSeenAt: { lt: cutoff } },
    });

    return successResponse({ deleted: deleted.count, cutoffIso: cutoff.toISOString() });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
