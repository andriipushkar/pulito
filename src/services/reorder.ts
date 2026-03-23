import { prisma } from '@/lib/prisma';
import { addToCart, CartError } from '@/services/cart';

export class ReorderError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ReorderError';
  }
}

export interface ReorderResult {
  added: { productId: number; productName: string; quantity: number }[];
  skipped: { productId: number; productName: string; reason: string }[];
}

/** Load order items and add them to user's cart */
export async function reorderFromOrder(orderId: number, userId: number): Promise<ReorderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new ReorderError('Замовлення не знайдено', 404);
  }

  // Validate user owns the order (or it's their guest order by email)
  if (order.userId !== userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user || order.contactEmail !== user.email) {
      throw new ReorderError('Немає доступу до цього замовлення', 403);
    }
  }

  const added: ReorderResult['added'] = [];
  const skipped: ReorderResult['skipped'] = [];

  for (const item of order.items) {
    if (!item.productId) {
      skipped.push({
        productId: 0,
        productName: item.productName,
        reason: 'Товар більше не існує',
      });
      continue;
    }

    try {
      await addToCart(userId, item.productId, item.quantity);
      added.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      });
    } catch (error) {
      if (error instanceof CartError) {
        skipped.push({
          productId: item.productId,
          productName: item.productName,
          reason: error.message,
        });
      } else {
        skipped.push({
          productId: item.productId,
          productName: item.productName,
          reason: 'Помилка додавання до кошика',
        });
      }
    }
  }

  return { added, skipped };
}
