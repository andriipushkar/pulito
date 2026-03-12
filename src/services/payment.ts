import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import type { PaymentProvider, PaymentInitResult, PaymentCallbackResult } from '@/types/payment';
import * as liqpay from './payment-providers/liqpay';
import * as monobank from './payment-providers/monobank';
import * as wayforpay from './payment-providers/wayforpay';

export class PaymentError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export async function initiatePayment(
  orderId: number,
  provider: PaymentProvider
): Promise<PaymentInitResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      paymentMethod: true,
      paymentStatus: true,
      payment: true,
    },
  });

  if (!order) {
    throw new PaymentError('Замовлення не знайдено', 404);
  }

  if (order.paymentMethod !== 'online') {
    throw new PaymentError('Це замовлення не потребує онлайн-оплати', 400);
  }

  if (order.paymentStatus === 'paid') {
    throw new PaymentError('Замовлення вже оплачено', 400);
  }

  const amount = Number(order.totalAmount);
  const description = `Замовлення #${order.orderNumber}`;
  const resultUrl = `${env.APP_URL}/checkout/payment-redirect?orderId=${orderId}`;

  let result: PaymentInitResult;

  if (provider === 'liqpay') {
    const serverUrl = `${env.APP_URL}/api/webhooks/liqpay`;
    result = await liqpay.createPayment(orderId, amount, description, resultUrl, serverUrl);
  } else if (provider === 'monobank') {
    const webhookUrl = `${env.APP_URL}/api/webhooks/monobank`;
    result = await monobank.createPayment(orderId, amount, description, resultUrl, webhookUrl);
  } else {
    const serviceUrl = `${env.APP_URL}/api/webhooks/wayforpay`;
    result = await wayforpay.createPayment(orderId, amount, description, resultUrl, serviceUrl);
  }

  // Create or update payment record
  await prisma.payment.upsert({
    where: { orderId },
    update: {
      paymentProvider: provider,
      transactionId: result.paymentId || null,
    },
    create: {
      orderId,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      amount,
      paymentProvider: provider,
      transactionId: result.paymentId || null,
    },
  });

  return result;
}

export async function handlePaymentCallback(
  provider: PaymentProvider,
  callbackResult: PaymentCallbackResult
): Promise<void> {
  const { orderId, status, transactionId, rawData, receiptUrl } = callbackResult;

  const payment = await prisma.payment.findUnique({
    where: { orderId },
  });

  // Resolve the actual order amount for cases where payment record doesn't exist yet
  const resolveAmount = async (): Promise<number> => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalAmount: true },
    });
    return order ? Number(order.totalAmount) : 0;
  };

  const mapStatus = (s: string): 'paid' | 'pending' => {
    if (s === 'success') return 'paid';
    // 'failure' and 'processing' both stay as 'pending' —
    // we don't mark as failed because the provider may retry or the user may retry payment
    return 'pending';
  };

  if (!payment) {
    const amount = await resolveAmount();
    await prisma.payment.create({
      data: {
        orderId,
        paymentMethod: 'online',
        paymentStatus: mapStatus(status),
        amount,
        paymentProvider: provider,
        transactionId,
        callbackData: rawData as unknown as Prisma.InputJsonValue,
        paidAt: status === 'success' ? new Date() : null,
        receiptUrl: receiptUrl || null,
      },
    });
  } else {
    await prisma.payment.update({
      where: { orderId },
      data: {
        paymentStatus: mapStatus(status),
        transactionId,
        callbackData: rawData as unknown as Prisma.InputJsonValue,
        paidAt: status === 'success' ? new Date() : payment.paidAt,
        receiptUrl: receiptUrl || payment.receiptUrl,
      },
    });
  }

  // Update order payment status
  if (status === 'success') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: 'paid',
            changeSource: 'system',
            comment: `Оплата підтверджена через ${provider}`,
          },
        },
      },
    });
  }
}

export async function getPaymentStatus(orderId: number) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      paymentStatus: true,
      paymentProvider: true,
      transactionId: true,
      amount: true,
      paidAt: true,
    },
  });

  return payment;
}
