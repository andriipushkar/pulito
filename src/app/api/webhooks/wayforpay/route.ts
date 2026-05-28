import { NextRequest } from 'next/server';
import { verifyCallback, createCallbackResponse } from '@/services/payment-providers/wayforpay';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit, readBoundedBody } from '@/utils/webhook-security';
import { logWebhook } from '@/services/webhook-log';
import { logger } from '@/lib/logger';

const PAYMENT_MAX_BODY = 64 * 1024;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('wayforpay', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    let body: ReturnType<typeof JSON.parse>;
    try {
      const raw = await readBoundedBody(request, PAYMENT_MAX_BODY);
      body = JSON.parse(raw);
    } catch (err) {
      if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
        return new Response('Payload too large', { status: 413 });
      }
      return new Response('Invalid JSON', { status: 400 });
    }

    if (!body || !body.merchantSignature) {
      logWebhook({
        source: 'wayforpay',
        event: 'missing_params',
        statusCode: 400,
        error: 'Missing merchantSignature',
      }).catch(() => {});
      return new Response('Missing signature', { status: 400 });
    }

    const callbackResult = await verifyCallback(body);
    await handlePaymentCallback('wayforpay', callbackResult);

    logWebhook({
      source: 'wayforpay',
      event: 'payment_callback',
      payload: { orderId: callbackResult.orderId, status: callbackResult.status },
      statusCode: 200,
      durationMs: Date.now() - startTime,
    }).catch(() => {});

    const responseBody = await createCallbackResponse(body.orderReference, 'accept');
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const isSignatureError =
      String(error).includes('підпис') ||
      String(error).includes('signature') ||
      String(error).includes('Signature');
    if (isSignatureError) {
      // See liqpay/route.ts for the rationale — 401 makes forging detectable
      // and lets monitoring alert; IP rate-limit caps retry-storm impact.
      logger.error('PAYMENT_WEBHOOK_SIGNATURE_MISMATCH', {
        provider: 'wayforpay',
        error: String(error),
      });
    } else {
      logger.error('WayForPay webhook error', { error: String(error) });
    }
    logWebhook({
      source: 'wayforpay',
      event: isSignatureError ? 'signature_failed' : 'error',
      statusCode: isSignatureError ? 401 : 500,
      error: String(error),
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    if (isSignatureError) {
      return new Response(JSON.stringify({ status: 'rejected', reason: 'invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ status: 'error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
