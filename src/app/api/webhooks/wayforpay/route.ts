import { NextRequest } from 'next/server';
import { verifyCallback, createCallbackResponse } from '@/services/payment-providers/wayforpay';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';
import { logWebhook } from '@/services/webhook-log';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('wayforpay', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    const body = await request.json();

    if (!body || !body.merchantSignature) {
      logWebhook({ source: 'wayforpay', event: 'missing_params', statusCode: 400, error: 'Missing merchantSignature' }).catch(() => {});
      return new Response('Missing signature', { status: 400 });
    }

    const callbackResult = verifyCallback(body);
    await handlePaymentCallback('wayforpay', callbackResult);

    logWebhook({ source: 'wayforpay', event: 'payment_callback', payload: { orderId: callbackResult.orderId, status: callbackResult.status }, statusCode: 200, durationMs: Date.now() - startTime }).catch(() => {});

    const responseBody = createCallbackResponse(body.orderReference, 'accept');
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const isSignatureError = String(error).includes('підпис') || String(error).includes('signature') || String(error).includes('Signature');
    logger.error('WayForPay webhook error', { error: String(error) });
    logWebhook({ source: 'wayforpay', event: isSignatureError ? 'signature_failed' : 'error', statusCode: isSignatureError ? 403 : 500, error: String(error), durationMs: Date.now() - startTime }).catch(() => {});
    const responseBody = JSON.stringify({ status: 'accept' });
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
