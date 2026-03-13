import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import type { CheckoutInput, OrderFilterInput } from '@/validators/order';

export class OrderError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

// Status transition matrix
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new_order: ['processing', 'cancelled'],
  processing: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'shipped', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed', 'returned'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};

// Client can only cancel in these statuses
const CLIENT_CANCELLABLE = ['new_order', 'processing'];

function generateOrderNumber(): string {
  const date = new Date();
  const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  clientType: true,
  totalAmount: true,
  itemsCount: true,
  contactName: true,
  contactPhone: true,
  paymentMethod: true,
  paymentStatus: true,
  deliveryMethod: true,
  trackingNumber: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderListSelect,
  userId: true,
  assignedManagerId: true,
  discountAmount: true,
  deliveryCost: true,
  contactEmail: true,
  deliveryCity: true,
  deliveryAddress: true,
  deliveryWarehouseRef: true,
  comment: true,
  managerComment: true,
  source: true,
  payment: {
    select: {
      receiptUrl: true,
      paymentProvider: true,
      transactionId: true,
      paidAt: true,
    },
  },
  user: { select: { id: true, fullName: true, email: true, role: true, wholesaleGroup: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productCode: true,
      productName: true,
      priceAtOrder: true,
      quantity: true,
      subtotal: true,
      isPromo: true,
      product: {
        select: {
          imagePath: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      },
    },
  },
  statusHistory: {
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      changeSource: true,
      comment: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.OrderSelect;

/**
 * @description Створює замовлення з товарів кошика, валідує оптові правила та зменшує залишки на складі.
 * @param userId - Ідентифікатор користувача (null для гостя)
 * @param checkout - Дані оформлення замовлення (контакти, доставка, оплата)
 * @param cartItems - Масив товарів для замовлення
 * @param clientType - Тип клієнта ('retail' або 'wholesale')
 * @returns Створене замовлення з деталями
 */
export async function createOrder(
  userId: number | null,
  checkout: CheckoutInput,
  cartItems: {
    productId: number;
    productCode: string;
    productName: string;
    price: number;
    quantity: number;
    isPromo: boolean;
  }[],
  clientType: 'retail' | 'wholesale'
) {
  if (cartItems.length === 0) {
    throw new OrderError('Кошик порожній', 400);
  }

  // Validate wholesale rules
  if (clientType === 'wholesale') {
    const rules = await prisma.wholesaleRule.findMany({
      where: { isActive: true, productId: null, ruleType: 'min_order_amount' },
    });

    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    for (const rule of rules) {
      if (totalAmount < Number(rule.value)) {
        throw new OrderError(
          `Мінімальна сума замовлення: ${Number(rule.value).toFixed(2)} ₴. Ваша сума: ${totalAmount.toFixed(2)} ₴`,
          400
        );
      }
    }

    // Per-product rules
    for (const item of cartItems) {
      const productRules = await prisma.wholesaleRule.findMany({
        where: { isActive: true, productId: item.productId },
      });

      for (const rule of productRules) {
        if (rule.ruleType === 'min_quantity' && item.quantity < Number(rule.value)) {
          throw new OrderError(
            `Мінімальна кількість для "${item.productName}": ${Number(rule.value)} шт.`,
            400
          );
        }
        if (rule.ruleType === 'multiplicity' && item.quantity % Number(rule.value) !== 0) {
          throw new OrderError(
            `"${item.productName}" замовляється кратно ${Number(rule.value)} шт.`,
            400
          );
        }
      }
    }
  }

  const itemsTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // Verify stock availability and decrement quantities
    for (const item of cartItems) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        throw new OrderError(
          `Товар "${item.productName}" недоступний у потрібній кількості`,
          400
        );
      }
    }

    // Create the order
    return tx.order.create({
      data: {
        orderNumber,
        userId,
        status: 'new_order',
        clientType,
        totalAmount: itemsTotal,
        discountAmount: 0,
        deliveryCost: 0,
        itemsCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
        contactName: checkout.contactName,
        contactPhone: checkout.contactPhone,
        contactEmail: checkout.contactEmail,
        deliveryMethod: checkout.deliveryMethod,
        deliveryCity: checkout.deliveryCity,
        deliveryWarehouseRef: checkout.deliveryWarehouseRef,
        deliveryAddress: checkout.deliveryAddress,
        paymentMethod: checkout.paymentMethod,
        paymentStatus: 'pending',
        comment: checkout.comment,
        source: 'web',
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            priceAtOrder: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
            isPromo: item.isPromo,
          })),
        },
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: 'new_order',
            changeSource: 'system',
            comment: 'Замовлення створено',
          },
        },
      },
      select: orderDetailSelect,
    });
  });

  // Clear server cart for authenticated users
  if (userId) {
    await prisma.cartItem.deleteMany({ where: { userId } });
  }

  // Notify manager about new order via Telegram
  import('@/services/telegram')
    .then((mod) => mod.notifyManagerNewOrder(order))
    .catch(() => {});

  return order;
}

/**
 * @description Отримує список замовлень користувача з пагінацією та фільтрами.
 * @param userId - Ідентифікатор користувача
 * @param filters - Фільтри (статус, дати, пагінація)
 * @returns Об'єкт зі списком замовлень та загальною кількістю
 */
export async function getUserOrders(userId: number, filters: OrderFilterInput) {
  const where: Prisma.OrderWhereInput = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.dateFrom) {
    where.createdAt = { ...(where.createdAt as object), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    where.createdAt = { ...(where.createdAt as object), lte: new Date(filters.dateTo) };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: orderListSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

/**
 * @description Отримує замовлення за ID з перевіркою належності користувачу.
 * @param orderId - Ідентифікатор замовлення
 * @param userId - Ідентифікатор користувача для перевірки доступу (опціонально)
 * @returns Замовлення з деталями або null
 */
export async function getOrderById(orderId: number, userId?: number) {
  const where: Prisma.OrderWhereUniqueInput = { id: orderId };

  const order = await prisma.order.findUnique({
    where,
    select: { ...orderDetailSelect, userId: true },
  });

  if (!order) return null;

  // Check ownership for non-admin requests
  if (userId !== undefined && order.userId !== userId) {
    return null;
  }

  return order;
}

/**
 * @description Отримує замовлення за його номером.
 * @param orderNumber - Номер замовлення
 * @returns Замовлення з деталями або null
 */
export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    select: orderDetailSelect,
  });
}

/**
 * @description Оновлює статус замовлення з валідацією допустимих переходів. Відновлює залишки при скасуванні/поверненні.
 * @param orderId - Ідентифікатор замовлення
 * @param newStatus - Новий статус
 * @param changedBy - ID користувача, який змінив статус (null для системи)
 * @param changeSource - Джерело зміни ('manager', 'client_action', 'system', 'cron')
 * @param comment - Коментар до зміни (опціонально)
 * @returns Оновлене замовлення з деталями
 */
export async function updateOrderStatus(
  orderId: number,
  newStatus: string,
  changedBy: number | null,
  changeSource: 'manager' | 'client_action' | 'system' | 'cron',
  comment?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      userId: true,
      items: { select: { productId: true, quantity: true } },
    },
  });

  if (!order) {
    throw new OrderError('Замовлення не знайдено', 404);
  }

  const currentStatus = order.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new OrderError(
      `Неможливо змінити статус з "${currentStatus}" на "${newStatus}"`,
      400
    );
  }

  // Client can only cancel their own orders
  if (changeSource === 'client_action') {
    if (order.userId !== changedBy) {
      throw new OrderError('Замовлення не знайдено', 404);
    }
    if (newStatus !== 'cancelled' || !CLIENT_CANCELLABLE.includes(currentStatus)) {
      throw new OrderError('Ви можете скасувати замовлення лише в статусах "Нове" або "В обробці"', 403);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Restore stock when order is cancelled or returned
    if (newStatus === 'cancelled' || newStatus === 'returned') {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as Prisma.EnumOrderStatusFieldUpdateOperationsInput['set'],
        ...(newStatus === 'cancelled' && {
          cancelledReason: comment,
          cancelledBy: changeSource,
        }),
        statusHistory: {
          create: {
            oldStatus: currentStatus,
            newStatus,
            changedBy,
            changeSource,
            comment,
          },
        },
      },
      select: orderDetailSelect,
    });
  });

  // Notify client about status change via Telegram
  if (order.userId) {
    import('@/services/telegram')
      .then((mod) =>
        mod.notifyClientStatusChange(
          order.userId!,
          updated.orderNumber,
          currentStatus,
          newStatus,
          updated.trackingNumber
        )
      )
      .catch(() => {});
  }

  // Loyalty: earn points on completion, handle referral status
  if (newStatus === 'completed' && order.userId) {
    import('@/services/loyalty')
      .then((mod) =>
        mod.earnPoints(order.userId!, orderId, Number(updated.totalAmount))
      )
      .catch(() => {});

    // Update referral status and award referrer bonus
    prisma.referral
      .findFirst({
        where: { referredUserId: order.userId, status: 'registered' },
        select: { id: true, referrerUserId: true },
      })
      .then(async (referral) => {
        if (!referral) return;

        // Update referral status to first_order
        await prisma.referral.update({
          where: { id: referral.id },
          data: { status: 'first_order', convertedAt: new Date() },
        });

        // Award referrer bonus points
        const loyaltyMod = await import('@/services/loyalty');
        await loyaltyMod.adjustPoints({
          userId: referral.referrerUserId,
          type: 'manual_add',
          points: 100,
          description: `Реферальний бонус: запрошений користувач зробив перше замовлення #${orderId}`,
        });

        // Mark referral as bonus_granted
        await prisma.referral.update({
          where: { id: referral.id },
          data: {
            status: 'bonus_granted',
            bonusType: 'points',
            bonusValue: 100,
          },
        });
      })
      .catch(() => {});
  }

  // Loyalty: deduct earned points on cancellation/return
  if ((newStatus === 'cancelled' || newStatus === 'returned') && order.userId) {
    import('@/services/loyalty')
      .then(async (mod) => {
        // Find the earn transaction for this order and reverse it
        const { prisma: db } = await import('@/lib/prisma');
        const earnTx = await db.loyaltyTransaction.findFirst({
          where: { userId: order.userId!, orderId, type: 'earn' },
          select: { points: true },
        });

        if (earnTx && earnTx.points > 0) {
          await mod.adjustPoints({
            userId: order.userId!,
            type: 'manual_deduct',
            points: earnTx.points,
            description: `Повернення балів: замовлення #${orderId} ${newStatus === 'cancelled' ? 'скасовано' : 'повернено'}`,
          });
        }
      })
      .catch(() => {});
  }

  return updated;
}

/**
 * @description Редагування позицій замовлення менеджером: додавання, видалення, зміна кількості товарів.
 * @param orderId - Ідентифікатор замовлення
 * @param items - Масив змін (itemId для оновлення/видалення, productId для додавання)
 * @param changedBy - ID менеджера, який вносить зміни
 * @returns Оновлене замовлення з деталями
 */
export async function editOrderItems(
  orderId: number,
  items: { itemId?: number; productId?: number; quantity: number; remove?: boolean }[],
  changedBy: number
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      items: {
        select: {
          id: true,
          productId: true,
          productCode: true,
          productName: true,
          priceAtOrder: true,
          quantity: true,
          subtotal: true,
          isPromo: true,
        },
      },
    },
  });

  if (!order) {
    throw new OrderError('Замовлення не знайдено', 404);
  }

  // Cannot edit items after payment has been confirmed
  if (order.paymentStatus === 'paid') {
    throw new OrderError('Редагування позицій неможливе: замовлення вже оплачено', 400);
  }

  // Can only edit items in early statuses
  if (!['new_order', 'processing', 'confirmed'].includes(order.status)) {
    throw new OrderError('Редагування позицій можливе тільки для замовлень у статусах: Нове, В обробці, Підтверджено', 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const change of items) {
      if (change.remove && change.itemId) {
        // Remove item — restore stock
        const existing = order.items.find((i) => i.id === change.itemId);
        if (existing && existing.productId) {
          await tx.product.update({
            where: { id: existing.productId },
            data: { quantity: { increment: existing.quantity } },
          });
        }
        await tx.orderItem.delete({ where: { id: change.itemId } });
      } else if (change.itemId) {
        // Update quantity of existing item
        const existing = order.items.find((i) => i.id === change.itemId);
        if (!existing) continue;

        const qtyDiff = change.quantity - existing.quantity;
        if (qtyDiff !== 0 && existing.productId) {
          // Check stock if increasing
          if (qtyDiff > 0) {
            const product = await tx.product.findUnique({
              where: { id: existing.productId },
              select: { quantity: true },
            });
            if (!product || product.quantity < qtyDiff) {
              throw new OrderError(`Недостатньо товару "${existing.productName}" на складі`, 400);
            }
          }
          await tx.product.update({
            where: { id: existing.productId },
            data: { quantity: { decrement: qtyDiff } },
          });
        }

        const newSubtotal = Number(existing.priceAtOrder) * change.quantity;
        await tx.orderItem.update({
          where: { id: change.itemId },
          data: { quantity: change.quantity, subtotal: newSubtotal },
        });
      } else if (change.productId && change.quantity > 0) {
        // Add new product
        const product = await tx.product.findUnique({
          where: { id: change.productId },
          select: { id: true, code: true, name: true, priceRetail: true, quantity: true },
        });

        if (!product) throw new OrderError('Товар не знайдено', 404);
        if (product.quantity < change.quantity) {
          throw new OrderError(`Недостатньо товару "${product.name}" на складі`, 400);
        }

        await tx.product.update({
          where: { id: product.id },
          data: { quantity: { decrement: change.quantity } },
        });

        await tx.orderItem.create({
          data: {
            orderId,
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            priceAtOrder: Number(product.priceRetail),
            quantity: change.quantity,
            subtotal: Number(product.priceRetail) * change.quantity,
            isPromo: false,
          },
        });
      }
    }

    // Recalculate totals
    const updatedItems = await tx.orderItem.findMany({
      where: { orderId },
      select: { quantity: true, subtotal: true },
    });

    const totalAmount = updatedItems.reduce((sum, i) => sum + Number(i.subtotal), 0);
    const itemsCount = updatedItems.reduce((sum, i) => sum + i.quantity, 0);

    // Add status history entry
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        oldStatus: order.status,
        newStatus: order.status,
        changedBy,
        changeSource: 'manager',
        comment: 'Позиції замовлення відредаговано',
      },
    });

    return tx.order.update({
      where: { id: orderId },
      data: { totalAmount, itemsCount },
      select: orderDetailSelect,
    });
  });

  return updated;
}

/**
 * @description Отримує всі замовлення з фільтрами та пагінацією (для адміністратора).
 * @param filters - Фільтри (статус, пошук, дати, пагінація)
 * @returns Об'єкт зі списком замовлень та загальною кількістю
 */
export async function getAllOrders(filters: OrderFilterInput & { clientType?: string }) {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.clientType) {
    where.clientType = filters.clientType as 'retail' | 'wholesale';
  }
  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }
  if (filters.deliveryMethod) {
    where.deliveryMethod = filters.deliveryMethod;
  }
  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: 'insensitive' } },
      { contactName: { contains: filters.search, mode: 'insensitive' } },
      { contactPhone: { contains: filters.search, mode: 'insensitive' } },
      { trackingNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.dateFrom) {
    where.createdAt = { ...(where.createdAt as object), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    where.createdAt = { ...(where.createdAt as object), lte: new Date(filters.dateTo) };
  }

  const skip = (filters.page - 1) * filters.limit;
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        ...orderListSelect,
        contactEmail: true,
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

export async function getOrderStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalNew,
    totalProcessing,
    totalToday,
    revenueToday,
    totalUnpaid,
  ] = await Promise.all([
    prisma.order.count({ where: { status: 'new_order' } }),
    prisma.order.count({ where: { status: 'processing' } }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: today }, status: { notIn: ['cancelled', 'returned'] } },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: { paymentStatus: 'pending', status: { notIn: ['cancelled', 'returned', 'completed'] } },
    }),
  ]);

  return {
    newOrders: totalNew,
    processingOrders: totalProcessing,
    todayOrders: totalToday,
    todayRevenue: Number(revenueToday._sum.totalAmount ?? 0),
    unpaidOrders: totalUnpaid,
  };
}
