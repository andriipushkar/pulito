import { NextRequest } from 'next/server';
import { verifyCallback } from '@/services/payment-providers/liqpay';
import { handlePaymentCallback } from '@/services/payment';
import { checkWebhookRateLimit } from '@/utils/webhook-security';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
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
      return new Response('Missing data or signature', { status: 400 });
    }

    const callbackResult = verifyCallback(data, signature);
    await handlePaymentCallback('liqpay', callbackResult);

    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('LiqPay webhook error', { error: String(error) });
    return new Response('Error', { status: 200 }); // Return 200 to prevent retries
  }
}
