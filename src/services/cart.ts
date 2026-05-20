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
    where: { userId, product: { deletedAt: null } },
    include: cartItemInclude,
    orderBy: { addedAt: 'desc' },
  });

  // Filter out inactive products — soft-deleted are already excluded by the
  // where clause above.
  return items.filter((item) => item.product.isActive);
}

/**
 * Get cart items with personal prices applied for the user.
 * Returns items with an additional `personalPrice` field (null if no personal price).
 */
export async function getCartWithPersonalPrices(userId: number) {
  const items = await getCartItems(userId);
  const { getEffectivePrice } = await import('@/services/personal-price');

  // Batch-fetch categoryId for every cart product in one query — the previous
  // per-item findUnique inside Promise.all generated N round-trips.
  const productIds = items.map((i) => i.product.id);
  const categoryRows =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true },
        })
      : [];
  const categoryByProductId = new Map<number, number | null>(
    categoryRows.map((r) => [r.id, r.categoryId]),
  );

  const withPrices = await Promise.all(
    items.map(async (item) => {
      const product = item.product;
      const categoryId = categoryByProductId.get(product.id) ?? null;

      const effective = await getEffectivePrice(userId, product.id, categoryId);

      let personalPrice: number | null = null;
      let personalStackable: string[] = [];
      if (effective?.fixedPrice !== null && effective?.fixedPrice !== undefined) {
        personalPrice = effective.fixedPrice;
        personalStackable = effective.stackableWith ?? [];
      } else if (effective?.discountPercent !== null && effective?.discountPercent !== undefined) {
        personalPrice = Math.round(Number(product.priceRetail) * (1 - effective.discountPercent / 100) * 100) / 100;
        personalStackable = effective.stackableWith ?? [];
      }

      return { ...item, personalPrice, personalStackable, categoryId };
    })
  );

  // Apply volume discounts — but only on items whose personal price allows
  // stacking with `volume`. Otherwise the customer keeps the personal price
  // alone (which is what most B2B price sheets expect).
  const { applyVolumeDiscounts } = await import('@/services/volume-pricing');
  const volumeDiscountItems = withPrices.map((item) => ({
    productId: item.product.id,
    categoryId: item.categoryId,
    quantity: item.quantity,
    // Volume discount calculates against the personal price if both apply,
    // else retail.
    price: item.personalPrice ?? Number(item.product.priceRetail),
  }));

  const volumeResults = await applyVolumeDiscounts(volumeDiscountItems);

  const withVolumeDiscounts = withPrices.map((item, index) => {
    const vd = volumeResults[index];
    // Stacking guard: if the personal price says it doesn't stack with
    // 'volume', drop the volume discount silently. Same in reverse via
    // applyVolumeDiscounts return (vd.stackableWith).
    const hasPersonal = item.personalPrice !== null;
    const personalAllowsVolume =
      !hasPersonal || (item.personalStackable ?? []).includes('volume');
    const volumeAllowsPersonal =
      !hasPersonal || (vd.stackableWith ?? []).includes('personal_price');
    const stacks = personalAllowsVolume && volumeAllowsPersonal;

    return {
      ...item,
      volumeDiscount:
        stacks && vd.discountPercent > 0
          ? {
              discountedPrice: vd.discountedPrice,
              discountPercent: vd.discountPercent,
              stackableWith: vd.stackableWith ?? [],
            }
          : null,
    };
  });

  return withVolumeDiscounts;
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
    select: { id: true, isActive: true, quantity: true, deletedAt: true },
  });

  if (!product || !product.isActive || product.deletedAt) {
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
  // Batch-fetch existing rows + product state in one shot, then write inside
  // a single $transaction. The previous serial findUnique/create-per-item
  // had a window where another tab could delete/deactivate the product
  // between the read and the create, so we'd insert an item for a product
  // that no longer exists or is out of stock.
  if (localItems.length === 0) return getCartItems(userId);

  const productIds = [...new Set(localItems.map((i) => i.productId))];
  const [existing, products] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId, productId: { in: productIds } },
      select: { productId: true },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null, quantity: { gt: 0 } },
      select: { id: true, quantity: true },
    }),
  ]);
  const existingSet = new Set(existing.map((e) => e.productId));
  const productMap = new Map(products.map((p) => [p.id, p.quantity]));

  const inserts = localItems
    .filter((item) => !existingSet.has(item.productId) && productMap.has(item.productId))
    .map((item) => ({
      userId,
      productId: item.productId,
      quantity: Math.min(item.quantity, productMap.get(item.productId) ?? 0),
    }))
    .filter((row) => row.quantity > 0);

  if (inserts.length > 0) {
    await prisma.$transaction(
      inserts.map((row) =>
        prisma.cartItem.upsert({
          where: { userId_productId: { userId, productId: row.productId } },
          create: row,
          update: {}, // existing row wins — local cart never overrides server
        }),
      ),
    );
  }

  return getCartItems(userId);
}

/**
 * Replace the user's server cart with exactly the items provided. Use this
 * when the client UI is the source of truth (e.g. on checkout submit) — unlike
 * mergeCart, items removed locally are removed server-side too, so the order
 * builder doesn't re-include them.
 */
export async function replaceCart(
  userId: number,
  desiredItems: { productId: number; quantity: number }[]
) {
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { userId } });
    if (desiredItems.length === 0) return;

    const productIds = desiredItems.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, isActive: true, quantity: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of desiredItems) {
      const product = productMap.get(item.productId);
      if (!product?.isActive || product.quantity <= 0) continue;
      await tx.cartItem.create({
        data: {
          userId,
          productId: item.productId,
          quantity: Math.min(item.quantity, product.quantity),
        },
      });
    }
  });

  return getCartItems(userId);
}
