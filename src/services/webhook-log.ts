import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Fields that may contain sensitive data — mask before storing
const SENSITIVE_KEYS = new Set([
  'card_number', 'cardNumber', 'card_pan', 'cardPan', 'pan',
  'cvv', 'cvv2', 'cvc', 'expiry', 'exp_month', 'exp_year',
  'card_token', 'token', 'access_token', 'private_key', 'secret',
  'password', 'signature', 'merchantSignature',
]);

/**
 * Recursively mask sensitive fields in webhook payload before storing.
 * Card numbers → "****1234", tokens/secrets → "***masked***"
 */
function sanitizePayload(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      if (typeof value === 'string' && value.length > 4) {
        // Show last 4 chars for card-like fields, mask the rest
        result[key] = '****' + value.slice(-4);
      } else {
        result[key] = '***masked***';
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function logWebhook(data: {
  source: string;
  event: string;
  payload?: unknown;
  statusCode?: number;
  error?: string;
  durationMs?: number;
}) {
  try {
    const sanitized = data.payload ? sanitizePayload(JSON.parse(JSON.stringify(data.payload))) : undefined;
    await prisma.webhookLog.create({
      data: {
        source: data.source,
        event: data.event,
        payload: sanitized as any,
        statusCode: data.statusCode,
        error: data.error,
        durationMs: data.durationMs,
      },
    });
  } catch {
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
