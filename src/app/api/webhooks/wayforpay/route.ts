import { NextRequest } from 'next/server';
import { verifyCallback, createCallbackResponse } from '@/services/payment-providers/wayforpay';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkWebhookRateLimit('wayforpay', ip);
    if (!allowed) {
      return new Response('Rate limited', { status: 429 });
    }

    const body = await request.json();

    if (!body || !body.merchantSignature) {
      return new Response('Missing signature', { status: 400 });
    }

    const callbackResult = verifyCallback(body);
    await handlePaymentCallback('wayforpay', callbackResult);

    // WayForPay requires a specific JSON response format to confirm receipt
    const responseBody = createCallbackResponse(body.orderReference, 'accept');

    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WayForPay webhook error:', error);
    // Return 200 with accept to prevent retries
    const responseBody = JSON.stringify({ status: 'accept' });
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
