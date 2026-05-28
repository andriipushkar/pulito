import crypto from 'crypto';
import { getLiqPayCreds } from '@/services/integration-credentials';
import { logger } from '@/lib/logger';
import type {
  PaymentInitResult,
  PaymentCallbackResult,
  RefundResult,
  LiqPayDecodedData,
} from '@/types/payment';

const CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

export class LiqPayError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'LiqPayError';
  }
}

function createSignature(data: string, privateKey: string): string {
  const signString = privateKey + data + privateKey;
  return crypto.createHash('sha1').update(signString).digest('base64');
}

function buildCheckoutUrl(params: Record<string, unknown>, privateKey: string): string {
  const data = Buffer.from(JSON.stringify(params)).toString('base64');
  const signature = createSignature(data, privateKey);
  return `${CHECKOUT_URL}?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;
}

export async function createPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serverUrl: string,
): Promise<PaymentInitResult> {
  const { publicKey, privateKey, sandbox } = await getLiqPayCreds();
  if (!publicKey || !privateKey) {
    throw new LiqPayError('LiqPay keys not configured');
  }

  const params: Record<string, unknown> = {
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
  if (sandbox) params.sandbox = 1;

  return { redirectUrl: buildCheckoutUrl(params, privateKey) };
}

async function createPaymentWithPaytypes(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serverUrl: string,
  paytypes: string,
  extra?: Record<string, unknown>,
): Promise<PaymentInitResult> {
  const { publicKey, privateKey, sandbox } = await getLiqPayCreds();
  if (!publicKey || !privateKey) {
    throw new LiqPayError('LiqPay keys not configured');
  }

  const params: Record<string, unknown> = {
    public_key: publicKey,
    version: 3,
    action: 'pay',
    amount,
    currency: 'UAH',
    description,
    order_id: `order_${orderId}`,
    result_url: resultUrl,
    server_url: serverUrl,
    paytypes,
    ...(extra ?? {}),
  };
  if (sandbox) params.sandbox = 1;

  return { redirectUrl: buildCheckoutUrl(params, privateKey) };
}

export async function createApplePayPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serverUrl: string,
): Promise<PaymentInitResult> {
  return createPaymentWithPaytypes(orderId, amount, description, resultUrl, serverUrl, 'apay');
}

export async function createGooglePayPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serverUrl: string,
): Promise<PaymentInitResult> {
  return createPaymentWithPaytypes(orderId, amount, description, resultUrl, serverUrl, 'gpay');
}

/**
 * "Оплата частинами" від ПриватБанку через LiqPay.
 * paytypes='paypart' пропонує клієнту розбити платіж на N місяців без переплат
 * (умови розстрочки залежать від клієнтського банку — ПриватБанк бере комісію
 * з мерчанта).
 */
export async function createPaypartPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serverUrl: string,
): Promise<PaymentInitResult> {
  const { paypartCount } = await getLiqPayCreds();
  return createPaymentWithPaytypes(orderId, amount, description, resultUrl, serverUrl, 'paypart', {
    instalment_count: paypartCount,
  });
}

export async function checkPaymentStatus(
  orderId: number,
): Promise<{ status: 'success' | 'failure' | 'processing'; amount?: number }> {
  const { publicKey, privateKey } = await getLiqPayCreds();
  if (!publicKey || !privateKey) return { status: 'processing' };

  const params = {
    public_key: publicKey,
    version: 3,
    action: 'status',
    order_id: `order_${orderId}`,
  };
  const data = Buffer.from(JSON.stringify(params)).toString('base64');
  const signature = createSignature(data, privateKey);

  const res = await fetch('https://www.liqpay.ua/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`,
  });
  if (!res.ok) return { status: 'processing' };
  const body: { status?: string; amount?: number } = await res.json();
  let status: 'success' | 'failure' | 'processing' = 'processing';
  if (body.status === 'success' || body.status === 'sandbox') status = 'success';
  else if (body.status === 'failure' || body.status === 'error' || body.status === 'reversed')
    status = 'failure';
  return { status, amount: body.amount };
}

export async function refundPayment(orderId: number, amount: number): Promise<RefundResult> {
  const { publicKey, privateKey } = await getLiqPayCreds();
  if (!publicKey || !privateKey) {
    throw new LiqPayError('LiqPay keys not configured');
  }

  const params = {
    public_key: publicKey,
    version: 3,
    action: 'refund',
    amount,
    currency: 'UAH',
    order_id: `order_${orderId}`,
  };

  const data = Buffer.from(JSON.stringify(params)).toString('base64');
  const signature = createSignature(data, privateKey);

  const res = await fetch('https://www.liqpay.ua/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`,
  });

  const responseData = await res.json();
  logger.info('LiqPay refund response', { orderId, status: responseData.status });

  if (responseData.status === 'reversed' || responseData.status === 'refund_wait') {
    return {
      success: true,
      refundId: String(responseData.payment_id || ''),
      status: responseData.status === 'reversed' ? 'refunded' : 'processing',
    };
  }

  return {
    success: false,
    status: 'failed',
    message: responseData.err_description || `LiqPay refund failed: ${responseData.status}`,
  };
}

export async function verifyCallback(
  data: string,
  signature: string,
): Promise<PaymentCallbackResult> {
  const { privateKey } = await getLiqPayCreds();
  if (!privateKey) {
    throw new LiqPayError('LiqPay keys not configured', 500);
  }
  const expectedSignature = createSignature(data, privateKey);

  const { safeEqual } = await import('@/utils/webhook-security');
  if (!safeEqual(signature, expectedSignature)) {
    throw new LiqPayError('Invalid LiqPay signature', 403);
  }

  const decoded: LiqPayDecodedData = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));

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
