import crypto from 'crypto';
import { env } from '@/config/env';
import type { PaymentInitResult, PaymentCallbackResult, WayForPayCallbackData } from '@/types/payment';

const API_URL = 'https://secure.wayforpay.com/pay';
const API_PURCHASE_URL = 'https://api.wayforpay.com/api';

export class WayForPayError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'WayForPayError';
  }
}

function createSignature(data: string[]): string {
  const signString = data.join(';');
  return crypto.createHmac('md5', env.WAYFORPAY_SECRET_KEY).update(signString).digest('hex');
}

export async function createPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serviceUrl: string
): Promise<PaymentInitResult> {
  const merchantAccount = env.WAYFORPAY_MERCHANT_ACCOUNT;
  const secretKey = env.WAYFORPAY_SECRET_KEY;

  if (!merchantAccount || !secretKey) {
    throw new WayForPayError('WayForPay credentials not configured');
  }

  const orderReference = `order_${orderId}_${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const productName = [description];
  const productCount = [1];
  const productPrice = [amount];
  const currency = 'UAH';

  // Signature: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName;productCount;productPrice
  const merchantDomain = new URL(env.APP_URL).hostname;
  const signatureData = [
    merchantAccount,
    merchantDomain,
    orderReference,
    String(orderDate),
    String(amount),
    currency,
    ...productName,
    ...productCount.map(String),
    ...productPrice.map(String),
  ];
  const signature = createSignature(signatureData);

  const res = await fetch(API_PURCHASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionType: 'CREATE_INVOICE',
      merchantAccount,
      merchantAuthType: 'SimpleSignature',
      merchantDomainName: merchantDomain,
      merchantSignature: signature,
      apiVersion: 1,
      orderReference,
      orderDate,
      amount,
      currency,
      productName,
      productCount,
      productPrice,
      returnUrl: resultUrl,
      serviceUrl,
      language: 'UA',
      paymentSystems: 'card;privat24;googlePay;applePay;masterPass',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new WayForPayError(`WayForPay API error: ${err}`, 502);
  }

  const data = await res.json();

  if (data.reasonCode !== 1100) {
    throw new WayForPayError(
      data.reason || `WayForPay error: ${data.reasonCode}`,
      400
    );
  }

  return {
    redirectUrl: data.invoiceUrl,
    paymentId: orderReference,
  };
}

export function verifyCallback(body: WayForPayCallbackData): PaymentCallbackResult {
  const secretKey = env.WAYFORPAY_SECRET_KEY;
  if (!secretKey) {
    throw new WayForPayError('WayForPay secret key not configured', 500);
  }

  // Verify signature: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
  const signatureData = [
    body.merchantAccount,
    body.orderReference,
    String(body.amount),
    body.currency,
    body.authCode || '',
    body.cardPan || '',
    body.transactionStatus,
    String(body.reasonCode),
  ];
  const expectedSignature = createSignature(signatureData);

  if (body.merchantSignature !== expectedSignature) {
    throw new WayForPayError('Invalid WayForPay signature', 403);
  }

  // Extract orderId from orderReference (format: order_<id>_<timestamp>)
  const match = body.orderReference.match(/^order_(\d+)/);
  if (!match) {
    throw new WayForPayError('Invalid orderReference in callback');
  }
  const orderId = parseInt(match[1], 10);

  let status: 'success' | 'failure' | 'processing' = 'processing';
  if (body.transactionStatus === 'Approved') {
    status = 'success';
  } else if (
    body.transactionStatus === 'Declined' ||
    body.transactionStatus === 'Refunded' ||
    body.transactionStatus === 'Voided' ||
    body.transactionStatus === 'Expired'
  ) {
    status = 'failure';
  }

  return {
    orderId,
    status,
    transactionId: String(body.transactionId || body.orderReference),
    rawData: body as unknown as Record<string, unknown>,
    receiptUrl: body.receiptUrl,
  };
}

/**
 * Generate response for WayForPay callback (must return specific JSON format)
 */
export function createCallbackResponse(orderReference: string, status: 'accept' | 'refuse' = 'accept'): string {
  const time = Math.floor(Date.now() / 1000);
  const signatureData = [orderReference, status, String(time)];
  const signature = createSignature(signatureData);

  return JSON.stringify({
    orderReference,
    status,
    time,
    signature,
  });
}
