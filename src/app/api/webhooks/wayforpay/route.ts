import { NextRequest } from 'next/server';
import { verifyCallback, createCallbackResponse } from '@/services/payment-providers/wayforpay';
import { handlePaymentCallback } from '@/services/payment';

export async function POST(request: NextRequest) {
  try {
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
