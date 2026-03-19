import { NextRequest } from 'next/server';
import { verifyCallback } from '@/services/payment-providers/monobank';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('monobank', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    const body = await request.text();
    const xSign = request.headers.get('X-Sign') || '';

    if (!body || !xSign) {
      return new Response('Missing body or X-Sign', { status: 400 });
    }

    const callbackResult = await verifyCallback(body, xSign);
    await handlePaymentCallback('monobank', callbackResult);

    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('Monobank webhook error', { error: String(error) });
    return new Response('Error', { status: 200 }); // Return 200 to prevent retries
  }
}
