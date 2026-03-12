import { prisma } from '@/lib/prisma';

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
  const daysSinceOrder = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceOrder > 14) {
    throw new ReturnError('Термін повернення (14 днів) минув');
  }

  // Check existing return request
  const existing = await prisma.returnRequest.findFirst({
    where: { orderId: data.orderId, status: { in: ['requested', 'approved'] } },
  });
  if (existing) throw new ReturnError('Запит на повернення вже існує для цього замовлення');

  // Calculate total
  const itemsData = data.items.map((item) => {
    const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
    if (!orderItem) throw new ReturnError(`Товар не знайдено в замовленні`);
    if (item.quantity > orderItem.quantity) throw new ReturnError(`Кількість перевищує замовлену`);
    return {
      orderItemId: orderItem.id,
      productName: orderItem.productName,
      quantity: item.quantity,
      amount: Number(orderItem.priceAtOrder) * item.quantity,
    };
  });

  const totalAmount = itemsData.reduce((sum, i) => sum + i.amount, 0);

  return prisma.returnRequest.create({
    data: {
      orderId: data.orderId,
      userId: data.userId,
      reason: data.reason as any,
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
  const where = status ? { status: status as any } : {};
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
  processedBy: number
) {
  const returnReq = await prisma.returnRequest.findUnique({ where: { id: returnId } });
  if (!returnReq) throw new ReturnError('Запит не знайдено', 404);
  if (returnReq.status !== 'requested') {
    throw new ReturnError('Запит вже оброблено');
  }

  return prisma.returnRequest.update({
    where: { id: returnId },
    data: {
      status,
      adminComment,
      processedBy,
      processedAt: new Date(),
    },
  });
}

export async function markReturnReceived(returnId: number) {
  return prisma.returnRequest.update({
    where: { id: returnId },
    data: { status: 'received' },
  });
}

export async function markReturnRefunded(returnId: number) {
  return prisma.returnRequest.update({
    where: { id: returnId },
    data: { status: 'refunded', refundedAt: new Date() },
  });
}
