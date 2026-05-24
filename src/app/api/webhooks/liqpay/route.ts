import { NextRequest } from 'next/server';
import { verifyCallback } from '@/services/payment-providers/liqpay';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';
import { logWebhook } from '@/services/webhook-log';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('liqpay', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    const formData = await request.formData();
    const data = formData.get('data') as string;
    const signature = formData.get('signature') as string;

    if (!data || !signature) {
      logWebhook({
        source: 'liqpay',
        event: 'missing_params',
        statusCode: 400,
        error: 'Missing data or signature',
      }).catch(() => {});
      return new Response('Missing data or signature', { status: 400 });
    }

    const callbackResult = await verifyCallback(data, signature);
    await handlePaymentCallback('liqpay', callbackResult);

    logWebhook({
      source: 'liqpay',
      event: 'payment_callback',
      payload: { orderId: callbackResult.orderId, status: callbackResult.status },
      statusCode: 200,
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return new Response('OK', { status: 200 });
  } catch (error) {
    const isSignatureError =
      String(error).includes('підпис') ||
      String(error).includes('signature') ||
      String(error).includes('Signature');
    if (isSignatureError) {
      // Signature mismatch = either rotated key (operator must update env)
      // or an attack. Either way log loudly so monitoring catches it; the
      // HTTP response stays 200 because LiqPay treats non-2xx as a retry
      // signal and we don't want a forged payload retried.
      logger.error('PAYMENT_WEBHOOK_SIGNATURE_MISMATCH', {
        provider: 'liqpay',
        error: String(error),
      });
    } else {
      logger.error('LiqPay webhook error', { error: String(error) });
    }
    logWebhook({
      source: 'liqpay',
      event: isSignatureError ? 'signature_failed' : 'error',
      statusCode: isSignatureError ? 403 : 500,
      error: String(error),
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return new Response('Error', { status: 200 });
  }
}
