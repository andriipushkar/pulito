import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/services/telegram';
import { logWebhook } from '@/services/webhook-log';

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    // Fail closed: if secret is configured, validate. If not configured, still require header to be absent.
    if (secretToken) {
      if (header !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, reject all requests if webhook secret is not configured
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const update = await request.json();
    const event = update.message ? 'message' : update.callback_query ? 'callback' : update.inline_query ? 'inline' : 'other';

    handleTelegramUpdate(update)
      .then(() => logWebhook({ source: 'telegram', event, statusCode: 200, durationMs: Date.now() - start }))
      .catch((err) => {
        console.error('Telegram processing error:', err);
        logWebhook({ source: 'telegram', event, statusCode: 500, error: err instanceof Error ? err.message : 'Unknown', durationMs: Date.now() - start });
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
