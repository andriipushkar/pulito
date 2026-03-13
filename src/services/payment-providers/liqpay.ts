import crypto from 'crypto';
import { env } from '@/config/env';
import type { PaymentInitResult, PaymentCallbackResult, LiqPayDecodedData } from '@/types/payment';

const CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

export class LiqPayError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'LiqPayError';
  }
}

function createSignature(data: string): string {
  const privateKey = env.LIQPAY_PRIVATE_KEY;
  const signString = privateKey + data + privateKey;
  return crypto.createHash('sha1').update(signString).digest('base64');
}

export async function createPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serverUrl: string
): Promise<PaymentInitResult> {
  const publicKey = env.LIQPAY_PUBLIC_KEY;
  if (!publicKey || !env.LIQPAY_PRIVATE_KEY) {
    throw new LiqPayError('LiqPay keys not configured');
  }

  const params = {
    public_key: publicKey,
    version: 3,
    action: 'pay',
    amount,
    currency: 'UAH',
    description,
    order_id: `order_${orderId}`,
    result_url: resultUrl,
    server_url: serverUrl,
  };

  const data = Buffer.from(JSON.stringify(params)).toString('base64');
  const signature = createSignature(data);

  const redirectUrl = `${CHECKOUT_URL}?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;

  return { redirectUrl };
}

export function verifyCallback(data: string, signature: string): PaymentCallbackResult {
  const expectedSignature = createSignature(data);

  if (signature !== expectedSignature) {
    throw new LiqPayError('Invalid LiqPay signature', 403);
  }

  const decoded: LiqPayDecodedData = JSON.parse(
    Buffer.from(data, 'base64').toString('utf-8')
  );

  const orderIdStr = decoded.order_id.replace('order_', '');
  const orderId = parseInt(orderIdStr, 10);

  if (isNaN(orderId)) {
    throw new LiqPayError('Invalid order_id in callback');
  }

  let status: 'success' | 'failure' | 'processing' = 'processing';
  if (decoded.status === 'success' || decoded.status === 'sandbox') {
    status = 'success';
  } else if (
    decoded.status === 'failure' ||
    decoded.status === 'error' ||
    decoded.status === 'reversed'
  ) {
    status = 'failure';
  }

  return {
    orderId,
    status,
    transactionId: String(decoded.transaction_id || decoded.payment_id || ''),
    rawData: decoded as unknown as Record<string, unknown>,
    amount: decoded.amount,
  };
}
