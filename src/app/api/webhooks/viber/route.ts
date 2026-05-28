import { NextRequest, NextResponse } from 'next/server';
import { handleViberEvent, verifyViberSignature } from '@/services/viber';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { logWebhook } from '@/services/webhook-log';
import { checkWebhookRateLimit, readBoundedBody } from '@/utils/webhook-security';

const VIBER_MAX_BODY = 256 * 1024;

// Viber retries failed deliveries. Dedupe by message_id (or timestamp+user_id
// fallback) for 24h so a retry doesn't re-create feedback rows or re-fire
// auto-replies. Mirrors the Telegram update_id strategy.
async function isDuplicateViberEvent(event: {
  message_token?: string | number;
  timestamp?: number;
  user_id?: string;
  sender?: { id?: string };
}): Promise<boolean> {
  const token =
    event.message_token != null
      ? `mt:${event.message_token}`
      : event.timestamp != null
        ? `ts:${event.timestamp}:${event.user_id || event.sender?.id || ''}`
        : null;
  if (!token) return false;
  try {
    const set = await redis.set(`vb:dedupe:${token}`, '1', 'EX', 86_400, 'NX');
    return set !== 'OK';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const allowed = await checkWebhookRateLimit('viber', ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    let rawBody: string;
    try {
      rawBody = await readBoundedBody(request, VIBER_MAX_BODY);
    } catch {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const signature = request.headers.get('x-viber-content-signature') || '';

    if (!verifyViberSignature(rawBody, signature)) {
      logWebhook({
        source: 'viber',
        event: 'signature_failed',
        statusCode: 403,
        durationMs: Date.now() - start,
      }).catch(() => {});
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const event = JSON.parse(rawBody);
    const eventType = typeof event?.event === 'string' ? event.event : 'unknown';

    if (await isDuplicateViberEvent(event)) {
      logWebhook({
        source: 'viber',
        event: `${eventType}:duplicate`,
        statusCode: 200,
        durationMs: Date.now() - start,
      }).catch(() => {});
      return NextResponse.json({ status: 0, deduped: true });
    }

    handleViberEvent(event)
      .then(() =>
        logWebhook({
          source: 'viber',
          event: eventType,
          statusCode: 200,
          durationMs: Date.now() - start,
        }),
      )
      .catch((err) => {
        logger.error('Viber processing error', {
          error: err instanceof Error ? err.message : String(err),
        });
        logWebhook({
          source: 'viber',
          event: eventType,
          statusCode: 500,
          error: err instanceof Error ? err.message : 'Unknown',
          durationMs: Date.now() - start,
        });
      });

    return NextResponse.json({ status: 0 });
  } catch (err) {
    // Genuine error (bad JSON, Redis dedup blowup) — surface a 500 so Viber
    // retries, and log it. Catch-all 200 used to mask failures.
    logger.error('Viber webhook error', {
      error: err instanceof Error ? err.message : String(err),
    });
    logWebhook({
      source: 'viber',
      event: 'error',
      statusCode: 500,
      error: err instanceof Error ? err.message : 'Unknown',
      durationMs: Date.now() - start,
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
