import { NextRequest } from 'next/server';
import { verifyCallback } from '@/services/payment-providers/monobank';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';
import { logWebhook } from '@/services/webhook-log';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('monobank', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    const body = await request.text();
    const xSign = request.headers.get('X-Sign') || '';

    if (!body || !xSign) {
      logWebhook({ source: 'monobank', event: 'missing_params', statusCode: 400, error: 'Missing body or X-Sign' }).catch(() => {});
      return new Response('Missing body or X-Sign', { status: 400 });
    }

    const callbackResult = await verifyCallback(body, xSign);
    await handlePaymentCallback('monobank', callbackResult);

    logWebhook({ source: 'monobank', event: 'payment_callback', payload: { orderId: callbackResult.orderId, status: callbackResult.status }, statusCode: 200, durationMs: Date.now() - startTime }).catch(() => {});
    return new Response('OK', { status: 200 });
  } catch (error) {
    const isSignatureError = String(error).includes('підпис') || String(error).includes('signature') || String(error).includes('Signature');
    logger.error('Monobank webhook error', { error: String(error) });
    logWebhook({ source: 'monobank', event: isSignatureError ? 'signature_failed' : 'error', statusCode: isSignatureError ? 403 : 500, error: String(error), durationMs: Date.now() - startTime }).catch(() => {});
    return new Response('Error', { status: 200 });
  }
}
