import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

const RETENTION_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);

    // 1. Drop expired entries from the dedicated table.
    const logDelete = await prisma.webhookLog.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });

    // 2. Clean up legacy webhook_log_* entries that were mistakenly written
    //    into siteSetting before WebhookLog adoption. Each had a unique
    //    timestamp key, so the table grows unbounded otherwise.
    const settingsDelete = await prisma.siteSetting.deleteMany({
      where: { key: { startsWith: 'webhook_log_' } },
    });

    return successResponse({
      logTableDeleted: logDelete.count,
      legacySettingsDeleted: settingsDelete.count,
      cutoffIso: cutoff.toISOString(),
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
