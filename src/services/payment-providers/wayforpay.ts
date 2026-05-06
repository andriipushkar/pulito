import crypto from 'crypto';
import { env } from '@/config/env';
import { getWayForPayCreds } from '@/services/integration-credentials';
import { logger } from '@/lib/logger';
import type {
  PaymentInitResult,
  PaymentCallbackResult,
  RefundResult,
  WayForPayCallbackData,
} from '@/types/payment';

const API_PURCHASE_URL = 'https://api.wayforpay.com/api';

export class WayForPayError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'WayForPayError';
  }
}

function createSignature(data: string[], secretKey: string): string {
  const signString = data.join(';');
  return crypto.createHmac('md5', secretKey).update(signString).digest('hex');
}

export async function createPayment(
  orderId: number,
  amount: number,
  description: string,
  resultUrl: string,
  serviceUrl: string,
  options?: { paymentSystems?: string },
): Promise<PaymentInitResult> {
  const { merchantAccount, secretKey } = await getWayForPayCreds();

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
  const signature = createSignature(signatureData, secretKey);

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
      paymentSystems: options?.paymentSystems ?? 'card;privat24;googlePay;applePay;masterPass',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new WayForPayError(`WayForPay API error: ${err}`, 502);
  }

  const data = await res.json();

  if (data.reasonCode !== 1100) {
    throw new WayForPayError(data.reason || `WayForPay error: ${data.reasonCode}`, 400);
  }

  return {
    redirectUrl: data.invoiceUrl,
    paymentId: orderReference,
  };
}

export async function checkTransactionStatus(
  orderReference: string,
): Promise<{ status: 'success' | 'failure' | 'processing'; amount?: number }> {
  const { merchantAccount, secretKey } = await getWayForPayCreds();
  if (!merchantAccount || !secretKey) return { status: 'processing' };

  const orderDate = Math.floor(Date.now() / 1000);
  // Signature for CHECK_STATUS: merchantAccount;orderReference;orderDate
  const signatureData = [merchantAccount, orderReference, String(orderDate)];
  const signature = createSignature(signatureData, secretKey);

  const res = await fetch(API_PURCHASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionType: 'CHECK_STATUS',
      merchantAccount,
      orderReference,
      apiVersion: 1,
      merchantSignature: signature,
    }),
  });
  if (!res.ok) return { status: 'processing' };
  const body: { transactionStatus?: string; amount?: number } = await res.json();
  let status: 'success' | 'failure' | 'processing' = 'processing';
  if (body.transactionStatus === 'Approved') status = 'success';
  else if (
    body.transactionStatus === 'Declined' ||
    body.transactionStatus === 'Expired' ||
    body.transactionStatus === 'Voided'
  )
    status = 'failure';
  return { status, amount: body.amount };
}

export async function refundPayment(
  orderReference: string,
  amount: number,
  _transactionId: string,
): Promise<RefundResult> {
  const { merchantAccount, secretKey } = await getWayForPayCreds();

  if (!merchantAccount || !secretKey) {
    throw new WayForPayError('WayForPay credentials not configured');
  }

  const signatureData = [merchantAccount, orderReference, String(amount), 'UAH'];
  const signature = createSignature(signatureData, secretKey);

  const res = await fetch(API_PURCHASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionType: 'REFUND',
      merchantAccount,
      orderReference,
      amount,
      currency: 'UAH',
      comment: 'Повернення коштів за товар',
      merchantSignature: signature,
      apiVersion: 1,
    }),
  });

  const data = await res.json();
  logger.info('WayForPay refund response', { orderReference, reasonCode: data.reasonCode });

  if (data.reasonCode === 1100) {
    return {
      success: true,
      refundId: String(data.transactionId || orderReference),
      status: 'refunded',
    };
  }

  return {
    success: false,
    status: 'failed',
    message: data.reason || `WayForPay refund failed: code ${data.reasonCode}`,
  };
}

export async function verifyCallback(body: WayForPayCallbackData): Promise<PaymentCallbackResult> {
  const { secretKey } = await getWayForPayCreds();
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
  const expectedSignature = createSignature(signatureData, secretKey);

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
    amount: body.amount,
  };
}

/**
 * Generate response for WayForPay callback (must return specific JSON format)
 */
export async function createCallbackResponse(
  orderReference: string,
  status: 'accept' | 'refuse' = 'accept',
): Promise<string> {
  const { secretKey } = await getWayForPayCreds();
  if (!secretKey) {
    throw new WayForPayError('WayForPay secret key not configured', 500);
  }
  const time = Math.floor(Date.now() / 1000);
  const signatureData = [orderReference, status, String(time)];
  const signature = createSignature(signatureData, secretKey);

  return JSON.stringify({
    orderReference,
    status,
    time,
    signature,
  });
}
