import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/services/telegram';
import { logWebhook } from '@/services/webhook-log';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { checkWebhookRateLimit, safeEqual, readBoundedBody } from '@/utils/webhook-security';

const TELEGRAM_MAX_BODY = 256 * 1024; // 256KB — covers media metadata

// Telegram retries updates on any non-2xx response and on client timeouts.
// We dedupe by `update_id` for 24h so a retried delivery doesn't run the
// handler twice (which would post duplicate messages, double-create
// feedback rows, etc).
async function isDuplicateUpdate(updateId: number | undefined): Promise<boolean> {
  if (!updateId) return false;
  try {
    // SETNX returns 1 if the key was set (first time we've seen this id),
    // 0 if it already existed (duplicate). TTL caps memory.
    const set = await redis.set(`tg:dedupe:${updateId}`, '1', 'EX', 86_400, 'NX');
    return set !== 'OK';
  } catch {
    // Redis down — skip dedupe rather than dropping legitimate updates.
    return false;
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate-limit per IP. Real Telegram serves from a small pool, so 100/min
  // (provider default) doesn't impede legit traffic but caps a retry-storm.
  const allowed = await checkWebhookRateLimit('telegram', ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    // Fail closed: if secret is configured, validate. If not configured, still
    // refuse production. Use constant-time compare so an attacker can't recover
    // the token via response-timing.
    if (secretToken) {
      if (!header || !safeEqual(header, secretToken)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    let rawBody: string;
    try {
      rawBody = await readBoundedBody(request, TELEGRAM_MAX_BODY);
    } catch {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const update = JSON.parse(rawBody);
    const event = update.message
      ? 'message'
      : update.callback_query
        ? 'callback'
        : update.inline_query
          ? 'inline'
          : 'other';

    if (await isDuplicateUpdate(update.update_id)) {
      logWebhook({
        source: 'telegram',
        event: `${event}:duplicate`,
        statusCode: 200,
        durationMs: Date.now() - start,
      });
      return NextResponse.json({ ok: true, deduped: true });
    }

    handleTelegramUpdate(update)
      .then(() =>
        logWebhook({ source: 'telegram', event, statusCode: 200, durationMs: Date.now() - start }),
      )
      .catch((err) => {
        logger.error('Telegram processing error', {
          error: err instanceof Error ? err.message : String(err),
        });
        logWebhook({
          source: 'telegram',
          event,
          statusCode: 500,
          error: err instanceof Error ? err.message : 'Unknown',
          durationMs: Date.now() - start,
        });
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Real error (bad JSON, Redis blowup) — log + 500 instead of swallowing
    // as 200. Telegram will retry, which is correct behaviour for genuinely
    // unprocessed events.
    logger.error('Telegram webhook error', {
      error: err instanceof Error ? err.message : String(err),
    });
    logWebhook({
      source: 'telegram',
      event: 'error',
      statusCode: 500,
      error: err instanceof Error ? err.message : 'Unknown',
      durationMs: Date.now() - start,
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
