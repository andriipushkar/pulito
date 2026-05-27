import { prisma } from '@/lib/prisma';
import { refundPayment } from '@/services/payment';
import { logger } from '@/lib/logger';
import { Prisma, type ReturnReason, type ReturnStatus } from '../../generated/prisma';

export class ReturnError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReturnError';
    this.statusCode = statusCode;
  }
}

export async function createReturnRequest(data: {
  orderId: number;
  userId: number;
  reason: string;
  description?: string;
  items: { orderItemId: number; quantity: number }[];
}) {
  // Verify order belongs to user
  const order = await prisma.order.findFirst({
    where: { id: data.orderId, userId: data.userId },
    include: { items: true },
  });

  if (!order) throw new ReturnError('Замовлення не знайдено', 404);
  if (!['completed', 'shipped'].includes(order.status)) {
    throw new ReturnError('Повернення можливе лише для доставлених замовлень');
  }

  // Check 14-day return window
  const daysSinceOrder = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceOrder > 14) {
    throw new ReturnError('Термін повернення (14 днів) минув');
  }

  // Check existing return request
  const existing = await prisma.returnRequest.findFirst({
    where: { orderId: data.orderId, status: { in: ['requested', 'approved'] } },
  });
  if (existing) throw new ReturnError('Запит на повернення вже існує для цього замовлення');

  // Calculate total using Decimal arithmetic — Number * qty loses kopiyka precision.
  const itemsData = data.items.map((item) => {
    const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
    if (!orderItem) throw new ReturnError(`Товар не знайдено в замовленні`);
    if (item.quantity > orderItem.quantity) throw new ReturnError(`Кількість перевищує замовлену`);
    const amount = new Prisma.Decimal(orderItem.priceAtOrder.toString()).mul(item.quantity);
    return {
      orderItemId: orderItem.id,
      productName: orderItem.productName,
      quantity: item.quantity,
      amount: amount.toString(),
    };
  });

  const totalAmount = itemsData.reduce((sum, i) => sum.add(i.amount), new Prisma.Decimal(0));

  return prisma.returnRequest.create({
    data: {
      orderId: data.orderId,
      userId: data.userId,
      reason: data.reason as ReturnReason,
      description: data.description,
      items: itemsData,
      totalAmount,
    },
  });
}

export async function getUserReturns(userId: number, page = 1, limit = 10) {
  const [returns, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.returnRequest.count({ where: { userId } }),
  ]);
  return { returns, total };
}

export async function getAdminReturns(page = 1, limit = 20, status?: string) {
  const where = status ? { status: status as ReturnStatus } : {};
  const [returns, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.returnRequest.count({ where }),
  ]);
  return { returns, total };
}

export async function processReturn(
  returnId: number,
  status: 'approved' | 'rejected',
  adminComment: string | undefined,
  processedBy: number,
) {
  const returnReq = await prisma.returnRequest.findUnique({ where: { id: returnId } });
  if (!returnReq) throw new ReturnError('Запит не знайдено', 404);
  if (returnReq.status !== 'requested') {
    throw new ReturnError('Запит вже оброблено');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.returnRequest.update({
      where: { id: returnId },
      data: {
        status,
        adminComment,
        processedBy,
        processedAt: new Date(),
      },
    });

    // Add status history to order when return is approved
    if (status === 'approved') {
      await tx.order.update({
        where: { id: returnReq.orderId },
        data: {
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: 'return_approved',
              changeSource: 'manager',
              comment: `Повернення #${returnId} схвалено`,
            },
          },
        },
      });
    }

    return updated;
  });
}

export async function markReturnReceived(returnId: number) {
  return prisma.returnRequest.update({
    where: { id: returnId },
    data: { status: 'received' },
  });
}

export async function markReturnRefunded(returnId: number) {
  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    select: {
      id: true,
      orderId: true,
      totalAmount: true,
      status: true,
    },
  });

  if (!returnReq) throw new ReturnError('Запит не знайдено', 404);
  if (returnReq.status !== 'received') {
    throw new ReturnError('Повернення можливе лише для отриманих товарів');
  }

  const refundAmount = Number(returnReq.totalAmount);

  // Atomic claim: flip 'received' → 'refunded' before calling the payment provider.
  // Without this, two parallel calls both pass the status check and both invoke
  // refundPayment, double-charging the merchant. updateMany returns count=0 if
  // another caller already won the race.
  const claimedAt = new Date();
  const claimed = await prisma.returnRequest.updateMany({
    where: { id: returnId, status: 'received' },
    data: { status: 'refunded', refundedAt: claimedAt },
  });
  if (claimed.count === 0) {
    throw new ReturnError('Повернення вже опрацьовується або вже виконано');
  }

  // Now we exclusively own the refund. If the payment provider fails, revert
  // so a human can retry — but only if our claim is still in place.
  const refundResult = await refundPayment(returnReq.orderId, refundAmount);

  if (!refundResult.success) {
    logger.error('Refund failed for return request', {
      returnId,
      orderId: returnReq.orderId,
      message: refundResult.message,
    });
    await prisma.returnRequest.updateMany({
      where: { id: returnId, status: 'refunded', refundedAt: claimedAt },
      data: { status: 'received', refundedAt: null },
    });
    throw new ReturnError(refundResult.message || 'Не вдалося виконати повернення коштів');
  }

  return prisma.returnRequest.findUnique({ where: { id: returnId } });
}
