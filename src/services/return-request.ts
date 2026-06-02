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

  // Sum quantities already returned for this order (any non-rejected return) so
  // the same unit can't be returned twice — otherwise stock would be re-restored
  // and points re-refunded on a repeat return of goods already sent back.
  const priorReturns = await prisma.returnRequest.findMany({
    where: {
      orderId: data.orderId,
      status: { in: ['requested', 'approved', 'received', 'refunded'] },
    },
    select: { items: true },
  });
  const alreadyReturned = new Map<number, number>();
  for (const pr of priorReturns) {
    const lines = Array.isArray(pr.items)
      ? (pr.items as Array<{ orderItemId?: number; quantity?: number }>)
      : [];
    for (const l of lines) {
      const id = Number(l.orderItemId);
      if (Number.isFinite(id))
        alreadyReturned.set(id, (alreadyReturned.get(id) ?? 0) + Number(l.quantity || 0));
    }
  }

  // Calculate total using Decimal arithmetic — Number * qty loses kopiyka precision.
  const itemsData = data.items.map((item) => {
    const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
    if (!orderItem) throw new ReturnError(`Товар не знайдено в замовленні`);
    const remaining = orderItem.quantity - (alreadyReturned.get(orderItem.id) ?? 0);
    if (item.quantity > remaining) {
      throw new ReturnError(
        remaining <= 0
          ? `Товар "${orderItem.productName}" вже повернено повністю`
          : `Можна повернути не більше ${remaining} шт товару "${orderItem.productName}"`,
      );
    }
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
  // Only allow approved → received. Without this precondition an admin could
  // flip an already-refunded return back to received and re-run the refund
  // (re-restoring stock + re-refunding points).
  const claimed = await prisma.returnRequest.updateMany({
    where: { id: returnId, status: 'approved' },
    data: { status: 'received' },
  });
  if (claimed.count === 0) {
    throw new ReturnError('Позначити отриманим можна лише схвалений запит на повернення');
  }
  return prisma.returnRequest.findUnique({ where: { id: returnId } });
}

export async function markReturnRefunded(returnId: number) {
  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    select: {
      id: true,
      orderId: true,
      userId: true,
      totalAmount: true,
      status: true,
      items: true,
    },
  });

  if (!returnReq) throw new ReturnError('Запит не знайдено', 404);
  if (returnReq.status !== 'received') {
    throw new ReturnError('Повернення можливе лише для отриманих товарів');
  }

  // ReturnRequest.totalAmount is GROSS goods value. The customer only PAID net
  // (after coupon/loyalty discounts), so cap the refund at what's actually
  // available on the payment — otherwise refundPayment throws «сума перевищує
  // доступну» on every discounted order and full returns become impossible.
  const pay = await prisma.payment.findUnique({
    where: { orderId: returnReq.orderId },
    select: { amount: true, refundedAmount: true },
  });
  const availableNet = pay
    ? Math.max(0, Number(pay.amount) - Number(pay.refundedAmount))
    : Number(returnReq.totalAmount);
  const refundAmount = Math.min(Number(returnReq.totalAmount), availableNet);

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

  // Restore stock for exactly the RETURNED line items. The RMA flow doesn't
  // flip Order.status, so the updateOrderStatus stock-restore never fires —
  // without this, returned goods are refunded but never become sellable again.
  // Per-item restore is correct for BOTH full and partial returns (we only add
  // back what physically came back). Best-effort: a failure here must not undo
  // the money refund that already succeeded.
  try {
    const lines = Array.isArray(returnReq.items)
      ? (returnReq.items as Array<{ orderItemId?: number; quantity?: number }>)
      : [];
    const orderItemIds = lines.map((l) => Number(l.orderItemId)).filter((n) => Number.isFinite(n));
    if (orderItemIds.length > 0) {
      const orderItems = await prisma.orderItem.findMany({
        where: { id: { in: orderItemIds } },
        select: { id: true, productId: true },
      });
      const productByItem = new Map(orderItems.map((oi) => [oi.id, oi.productId]));
      await prisma.$transaction(
        lines
          .filter((l) => productByItem.get(Number(l.orderItemId)) && Number(l.quantity) > 0)
          .map((l) =>
            prisma.product.update({
              where: { id: productByItem.get(Number(l.orderItemId))! },
              data: { quantity: { increment: Number(l.quantity) } },
            }),
          ),
      );
    }
  } catch (err) {
    logger.error('Stock restore after RMA refund failed (refund already done)', {
      returnId,
      orderId: returnReq.orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Loyalty points reversal, PROPORTIONAL to the value of the returned goods
  // (owner rule). proportion = returned goods value / total order goods value.
  // We refund the same fraction of points the customer SPENT on the order, and
  // claw back the same fraction of points they EARNED (symmetric with the full
  // cancel/return path). Best-effort + integer (points are an Int column).
  try {
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: returnReq.orderId },
      select: { subtotal: true },
    });
    const orderGoodsTotal = allItems.reduce((s, i) => s + Number(i.subtotal), 0);
    const returnedGoods = Number(returnReq.totalAmount);
    const proportion = orderGoodsTotal > 0 ? Math.min(1, returnedGoods / orderGoodsTotal) : 0;

    if (proportion > 0) {
      const { adjustPoints } = await import('@/services/loyalty');
      // Refund the proportional share of points the customer SPENT on the
      // order. We do NOT claw back earned points here — refundPayment already
      // does that pro-rata of the refunded amount (payment.ts). Doing it again
      // would double-penalise the customer's earned points.
      const spends = await prisma.loyaltyTransaction.findMany({
        where: { userId: returnReq.userId, orderId: returnReq.orderId, type: 'spend' },
        select: { points: true },
      });
      // 'spend' is stored negative → abs.
      const spentAbs = Math.abs(spends.reduce((s, t) => s + t.points, 0));
      const refundSpent = Math.floor(spentAbs * proportion);

      if (refundSpent > 0) {
        await adjustPoints({
          userId: returnReq.userId,
          type: 'manual_add',
          points: refundSpent,
          description: `Повернення балів за повернені товари (замовлення #${returnReq.orderId})`,
        });
      }
    }
  } catch (err) {
    logger.error('Loyalty reversal after RMA refund failed (refund already done)', {
      returnId,
      orderId: returnReq.orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return prisma.returnRequest.findUnique({ where: { id: returnId } });
}
