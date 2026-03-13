import crypto from 'crypto';
import { env } from '@/config/env';
import type {
  PaymentInitResult,
  PaymentCallbackResult,
  MonobankCallbackData,
  MonobankInvoiceResponse,
} from '@/types/payment';

const API_BASE = 'https://api.monobank.ua/api/merchant';
const MONO_PUBKEY_URL = 'https://api.monobank.ua/api/merchant/pubkey';

export class MonobankError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MonobankError';
  }
}

let cachedPubKey: { key: crypto.KeyObject; expiresAt: number } | null = null;

async function getMonoPubKey(): Promise<crypto.KeyObject> {
  if (cachedPubKey && cachedPubKey.expiresAt > Date.now()) {
    return cachedPubKey.key;
  }

  const res = await fetch(MONO_PUBKEY_URL, {
    headers: { 'X-Token': env.MONOBANK_TOKEN },
  });

  if (!res.ok) {
    throw new MonobankError('Failed to get Monobank public key', 502);
  }

  const { key } = await res.json();
  const pubKey = crypto.createPublicKey({
    key: Buffer.from(key, 'base64'),
    format: 'der',
    type: 'spki',
  });

  cachedPubKey = { key: pubKey, expiresAt: Date.now() + 86400000 }; // 24h
  return pubKey;
}

export async function createPayment(
  orderId: number,
  amount: number,
  description: string,
  redirectUrl: string,
  webhookUrl: string
): Promise<PaymentInitResult> {
  const token = env.MONOBANK_TOKEN;
  if (!token) {
    throw new MonobankError('Monobank token not configured');
  }

  const res = await fetch(`${API_BASE}/invoice/create`, {
    method: 'POST',
    headers: {
      'X-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // amount in kopecks
      ccy: 980, // UAH
      merchantPaymInfo: {
        reference: `order_${orderId}`,
        destination: description,
      },
      redirectUrl,
      webHookUrl: webhookUrl,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new MonobankError(
      `Monobank API error: ${(error as { errText?: string }).errText || res.status}`,
      res.status >= 500 ? 502 : res.status
    );
  }

  const data: MonobankInvoiceResponse = await res.json();

  return {
    redirectUrl: data.pageUrl,
    paymentId: data.invoiceId,
  };
}

export async function verifyCallback(
  body: string,
  xSignHeader: string
): Promise<PaymentCallbackResult> {
  const pubKey = await getMonoPubKey();

  const isValid = crypto.verify(
    'SHA256',
    Buffer.from(body),
    pubKey,
    Buffer.from(xSignHeader, 'base64')
  );

  if (!isValid) {
    throw new MonobankError('Invalid Monobank signature', 403);
  }

  const data: MonobankCallbackData = JSON.parse(body);

  // Reject stale webhooks older than 10 minutes
  const WEBHOOK_MAX_AGE_MS = 10 * 60 * 1000;
  if (data.modifiedDate) {
    const webhookTime = new Date(data.modifiedDate).getTime();
    if (!isNaN(webhookTime) && Date.now() - webhookTime > WEBHOOK_MAX_AGE_MS) {
      throw new MonobankError('Webhook timestamp too old', 400);
    }
  }

  const orderIdStr = data.reference.replace('order_', '');
  const orderId = parseInt(orderIdStr, 10);

  if (isNaN(orderId)) {
    throw new MonobankError('Invalid reference in callback');
  }

  let status: 'success' | 'failure' | 'processing' = 'processing';
  if (data.status === 'success') {
    status = 'success';
  } else if (data.status === 'failure' || data.status === 'reversed') {
    status = 'failure';
  }

  return {
    orderId,
    status,
    transactionId: data.invoiceId,
    rawData: data as unknown as Record<string, unknown>,
    receiptUrl: data.receiptUrl,
    amount: data.amount / 100,
  };
}
