import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function logWebhook(data: {
  source: string;
  event: string;
  payload?: unknown;
  statusCode?: number;
  error?: string;
  durationMs?: number;
}) {
  try {
    await prisma.webhookLog.create({
      data: {
        source: data.source,
        event: data.event,
        payload: data.payload ? JSON.parse(JSON.stringify(data.payload)) : undefined,
        statusCode: data.statusCode,
        error: data.error,
        durationMs: data.durationMs,
      },
    });
  } catch {
    // Don't fail the webhook handler if logging fails
    logger.error('Failed to log webhook', { source: data.source, event: data.event });
  }
}

export async function getWebhookLogs(params: {
  source?: string;
  page?: number;
  limit?: number;
}) {
  const { source, page = 1, limit = 50 } = params;
  const where = source ? { source } : {};

  const [logs, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.webhookLog.count({ where }),
  ]);

  return { logs, total };
}
