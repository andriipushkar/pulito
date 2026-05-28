import { NextRequest } from 'next/server';
import { verifyCallback } from '@/services/payment-providers/liqpay';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';
import { logWebhook } from '@/services/webhook-log';
import { logger } from '@/lib/logger';

const PAYMENT_MAX_BODY = 64 * 1024; // 64KB — LiqPay callbacks are ~1-2KB

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('liqpay', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    // Cap body size before formData parsing — Content-Length header is the
    // first gate so we don't allocate hundreds of MB for a hostile payload.
    const cl = Number(request.headers.get('content-length') || 0);
    if (cl > PAYMENT_MAX_BODY) {
      return new Response('Payload too large', { status: 413 });
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
      // or an attack. Return 401 so:
      //   1. An attacker can't distinguish a successful forgery from any
      //      other response (was returning 200, making forging undetectable).
      //   2. Monitoring/alerting catches the loud HTTP status.
      // LiqPay will retry — but the same forged payload re-fails signature
      // each time, exhausting their retry budget without ever succeeding.
      // The IP-based rate limit at line 12 stops a high-volume retry storm.
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
      statusCode: isSignatureError ? 401 : 500,
      error: String(error),
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return new Response(isSignatureError ? 'Invalid signature' : 'Error', {
      status: isSignatureError ? 401 : 500,
    });
  }
}
