import { prisma } from '@/lib/prisma';

const cartItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
      quantity: true,
      isPromo: true,
      isActive: true,
      imagePath: true,
      images: {
        select: { pathThumbnail: true },
        where: { isMain: true },
        take: 1,
      },
    },
  },
} as const;

export class CartError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CartError';
  }
}

/**
 * @description Отримує товари кошика користувача, фільтруючи неактивні продукти.
 * @param userId - Ідентифікатор користувача
 * @returns Масив товарів кошика з даними продуктів
 */
export async function getCartItems(userId: number) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: cartItemInclude,
    orderBy: { addedAt: 'desc' },
  });

  // Filter out inactive products
  return items.filter((item) => item.product.isActive);
}

/**
 * Get cart items with personal prices applied for the user.
 * Returns items with an additional `personalPrice` field (null if no personal price).
 */
export async function getCartWithPersonalPrices(userId: number) {
  const items = await getCartItems(userId);
  const { getEffectivePrice } = await import('@/services/personal-price');

  const withPrices = await Promise.all(
    items.map(async (item) => {
      const product = item.product;
      const categoryId = await prisma.product
        .findUnique({ where: { id: product.id }, select: { categoryId: true } })
        .then((p) => p?.categoryId ?? null);

      const effective = await getEffectivePrice(userId, product.id, categoryId);

      let personalPrice: number | null = null;
      if (effective?.fixedPrice !== null && effective?.fixedPrice !== undefined) {
        personalPrice = effective.fixedPrice;
      } else if (effective?.discountPercent !== null && effective?.discountPercent !== undefined) {
        personalPrice = Math.round(Number(product.priceRetail) * (1 - effective.discountPercent / 100) * 100) / 100;
      }

      return { ...item, personalPrice };
    })
  );

  return withPrices;
}

/**
 * @description Додає товар до кошика або збільшує кількість, якщо він вже є. Перевіряє наявність на складі.
 * @param userId - Ідентифікатор користувача
 * @param productId - Ідентифікатор товару
 * @param quantity - Кількість для додавання
 * @returns Оновлений або створений елемент кошика
 */
export async function addToCart(userId: number, productId: number, quantity: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true, quantity: true },
  });

  if (!product || !product.isActive) {
    throw new CartError('Товар не знайдено або недоступний', 404);
  }

  if (product.quantity < quantity) {
    throw new CartError(`Недостатньо товару. Доступно: ${product.quantity} шт.`, 400);
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existing) {
    const newQuantity = existing.quantity + quantity;
    if (newQuantity > product.quantity) {
      throw new CartError(`Недостатньо товару. Доступно: ${product.quantity} шт.`, 400);
    }
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
      include: cartItemInclude,
    });
  }

  return prisma.cartItem.create({
    data: { userId, productId, quantity },
    include: cartItemInclude,
  });
}

/**
 * @description Оновлює кількість існуючого товару в кошику.
 * @param userId - Ідентифікатор користувача
 * @param productId - Ідентифікатор товару
 * @param quantity - Нова кількість
 * @returns Оновлений елемент кошика
 */
export async function updateCartItem(userId: number, productId: number, quantity: number) {
  const item = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (!item) {
    throw new CartError('Товар не знайдено в кошику', 404);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { quantity: true },
  });

  if (product && quantity > product.quantity) {
    throw new CartError(`Недостатньо товару. Доступно: ${product.quantity} шт.`, 400);
  }

  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity },
    include: cartItemInclude,
  });
}

/**
 * @description Видаляє товар з кошика за productId.
 * @param userId - Ідентифікатор користувача
 * @param productId - Ідентифікатор товару для видалення
 * @returns void
 */
export async function removeFromCart(userId: number, productId: number) {
  const item = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (!item) {
    throw new CartError('Товар не знайдено в кошику', 404);
  }

  await prisma.cartItem.delete({ where: { id: item.id } });
}

/**
 * @description Очищає всі товари з кошика користувача.
 * @param userId - Ідентифікатор користувача
 * @returns void
 */
export async function clearCart(userId: number) {
  await prisma.cartItem.deleteMany({ where: { userId } });
}

/**
 * @description Об'єднує локальний (анонімний) кошик з серверним кошиком після авторизації.
 * @param userId - Ідентифікатор користувача
 * @param localItems - Масив товарів з локального кошика (productId, quantity)
 * @returns Оновлений масив товарів кошика
 */
export async function mergeCart(
  userId: number,
  localItems: { productId: number; quantity: number }[]
) {
  for (const item of localItems) {
    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId: item.productId } },
    });

    if (!existing) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { isActive: true, quantity: true },
      });

      if (product?.isActive && product.quantity > 0) {
        await prisma.cartItem.create({
          data: {
            userId,
            productId: item.productId,
            quantity: Math.min(item.quantity, product.quantity),
          },
        });
      }
    }
  }

  return getCartItems(userId);
}
