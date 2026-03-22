import { prisma } from '@/lib/prisma';
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from '@/validators/subscription';

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
};

function calculateNextDelivery(frequency: string): Date {
  const days = FREQUENCY_DAYS[frequency] ?? 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createSubscription(userId: number, data: CreateSubscriptionInput) {
  const nextDeliveryAt = calculateNextDelivery(data.frequency);

  return prisma.subscription.create({
    data: {
      userId,
      frequency: data.frequency,
      nextDeliveryAt,
      deliveryMethod: data.deliveryMethod,
      deliveryCity: data.deliveryCity,
      deliveryAddress: data.deliveryAddress,
      paymentMethod: data.paymentMethod,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
          },
        },
      },
    },
  });
}

export async function getUserSubscriptions(userId: number) {
  return prisma.subscription.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSubscriptionById(id: number, userId: number) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
          },
        },
      },
    },
  });

  if (!subscription) {
    throw new SubscriptionError('Підписку не знайдено', 404);
  }

  return subscription;
}

export async function updateSubscription(id: number, userId: number, data: UpdateSubscriptionInput) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
  });

  if (!subscription) {
    throw new SubscriptionError('Підписку не знайдено', 404);
  }

  if (subscription.status === 'cancelled') {
    throw new SubscriptionError('Неможливо оновити скасовану підписку', 400);
  }

  const updateData: Record<string, unknown> = {};

  if (data.frequency) {
    updateData.frequency = data.frequency;
    updateData.nextDeliveryAt = calculateNextDelivery(data.frequency);
  }
  if (data.status) updateData.status = data.status;
  if (data.deliveryMethod !== undefined) updateData.deliveryMethod = data.deliveryMethod;
  if (data.deliveryCity !== undefined) updateData.deliveryCity = data.deliveryCity;
  if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;

  return prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.subscriptionItem.deleteMany({ where: { subscriptionId: id } });
      await tx.subscriptionItem.createMany({
        data: data.items.map((item) => ({
          subscriptionId: id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
    }

    return tx.subscription.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
            },
          },
        },
      },
    });
  });
}

export async function pauseSubscription(id: number, userId: number) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
  });

  if (!subscription) {
    throw new SubscriptionError('Підписку не знайдено', 404);
  }

  if (subscription.status !== 'active') {
    throw new SubscriptionError('Призупинити можна лише активну підписку', 400);
  }

  return prisma.subscription.update({
    where: { id },
    data: {
      status: 'paused',
      pausedAt: new Date(),
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
          },
        },
      },
    },
  });
}

export async function resumeSubscription(id: number, userId: number) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
  });

  if (!subscription) {
    throw new SubscriptionError('Підписку не знайдено', 404);
  }

  if (subscription.status !== 'paused') {
    throw new SubscriptionError('Відновити можна лише призупинену підписку', 400);
  }

  return prisma.subscription.update({
    where: { id },
    data: {
      status: 'active',
      pausedAt: null,
      nextDeliveryAt: calculateNextDelivery(subscription.frequency),
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
          },
        },
      },
    },
  });
}

export async function cancelSubscription(id: number, userId: number) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
  });

  if (!subscription) {
    throw new SubscriptionError('Підписку не знайдено', 404);
  }

  if (subscription.status === 'cancelled') {
    throw new SubscriptionError('Підписку вже скасовано', 400);
  }

  return prisma.subscription.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, priceRetail: true, imagePath: true },
          },
        },
      },
    },
  });
}
