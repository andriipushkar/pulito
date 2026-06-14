import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { addToCart } from '@/services/cart';
import {
  addMoney,
  subtractMoney,
  lineTotal,
  percentOf,
  minMoney,
  maxMoney,
  round2,
} from '@/utils/money';

export class BundleError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'BundleError';
  }
}

const bundleItemsInclude = {
  items: {
    include: {
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
          imagePath: true,
          isActive: true,
          quantity: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

export async function createBundle(
  data: {
    name: string;
    slug?: string;
    description?: string;
    nameEn?: string;
    descriptionEn?: string;
    bundleType: 'curated' | 'custom';
    discountPercent?: number;
    fixedPrice?: number | null;
    imagePath?: string;
    items: { productId: number; quantity: number }[];
  },
  createdBy: number,
) {
  const slug = data.slug || createSlug(data.name);

  const existing = await prisma.bundle.findUnique({ where: { slug } });
  if (existing) {
    throw new BundleError('Комплект з таким slug вже існує', 409);
  }

  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });

  if (products.length !== productIds.length) {
    throw new BundleError('Один або декілька товарів не знайдено', 404);
  }

  return prisma.bundle.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      nameEn: data.nameEn || null,
      descriptionEn: data.descriptionEn || null,
      bundleType: data.bundleType,
      discountPercent: data.discountPercent ?? 0,
      fixedPrice: data.fixedPrice,
      imagePath: data.imagePath,
      createdBy,
      items: {
        create: data.items.map((item, index) => ({
          productId: item.productId,
          quantity: item.quantity,
          sortOrder: index,
        })),
      },
    },
    include: bundleItemsInclude,
  });
}

export async function updateBundle(
  id: number,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    nameEn?: string;
    descriptionEn?: string;
    bundleType?: 'curated' | 'custom';
    discountPercent?: number;
    fixedPrice?: number | null;
    imagePath?: string;
    items?: { productId: number; quantity: number }[];
  },
) {
  const bundle = await prisma.bundle.findUnique({ where: { id } });
  if (!bundle) throw new BundleError('Комплект не знайдено', 404);

  if (data.slug && data.slug !== bundle.slug) {
    const existing = await prisma.bundle.findUnique({ where: { slug: data.slug } });
    if (existing) throw new BundleError('Комплект з таким slug вже існує', 409);
  }

  if (data.items) {
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    if (products.length !== productIds.length) {
      throw new BundleError('Один або декілька товарів не знайдено', 404);
    }
  }

  return prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.bundleItem.deleteMany({ where: { bundleId: id } });
      await tx.bundleItem.createMany({
        data: data.items.map((item, index) => ({
          bundleId: id,
          productId: item.productId,
          quantity: item.quantity,
          sortOrder: index,
        })),
      });
    }

    return tx.bundle.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn || null }),
        ...(data.descriptionEn !== undefined && {
          descriptionEn: data.descriptionEn || null,
        }),
        ...(data.bundleType !== undefined && { bundleType: data.bundleType }),
        ...(data.discountPercent !== undefined && { discountPercent: data.discountPercent }),
        ...(data.fixedPrice !== undefined && { fixedPrice: data.fixedPrice }),
        ...(data.imagePath !== undefined && { imagePath: data.imagePath }),
      },
      include: bundleItemsInclude,
    });
  });
}

export async function deleteBundle(id: number) {
  const bundle = await prisma.bundle.findUnique({ where: { id } });
  if (!bundle) throw new BundleError('Комплект не знайдено', 404);

  await prisma.bundle.delete({ where: { id } });
}

export async function getActiveBundles(page: number, limit: number) {
  const where = { isActive: true };

  const [bundles, total] = await Promise.all([
    prisma.bundle.findMany({
      where,
      include: bundleItemsInclude,
      orderBy: { sortOrder: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bundle.count({ where }),
  ]);

  return { bundles, total };
}

export async function getBundleBySlug(slug: string) {
  return prisma.bundle.findUnique({
    where: { slug, isActive: true },
    include: bundleItemsInclude,
  });
}

export async function calculateBundlePrice(bundleId: number) {
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          product: { select: { priceRetail: true, priceRetailOld: true, isPromo: true } },
        },
      },
    },
  });

  if (!bundle) throw new BundleError('Комплект не знайдено', 404);

  // originalPrice = sum of normal (pre-promo) prices. Used for "save up to X" copy
  // shown alongside the bundle, so the discount looks like a real saving against
  // the everyday price — not just a re-shuffle of the current promo.
  const originalPrice = bundle.items.reduce((sum, item) => {
    const base =
      item.product.isPromo && item.product.priceRetailOld
        ? Number(item.product.priceRetailOld)
        : Number(item.product.priceRetail);
    return sum + base * item.quantity;
  }, 0);

  // effectivePromoPrice = what the customer would pay RIGHT NOW buying the items
  // individually (with each item's current promo applied). If the bundle's price
  // is higher than this, the bundle is worse than buying items separately, so we
  // clamp to the promo total — best-deal-wins.
  const effectivePromoPrice = bundle.items.reduce(
    (sum, item) => sum + Number(item.product.priceRetail) * item.quantity,
    0,
  );

  // Compute the bundle's nominal final price (from fixedPrice or discountPercent
  // applied to originalPrice — knock-down from normal-pricing baseline).
  let bundleFinalPrice: number;
  if (bundle.fixedPrice) {
    bundleFinalPrice = Number(bundle.fixedPrice);
  } else {
    const discount = Number(bundle.discountPercent);
    bundleFinalPrice = originalPrice * (1 - discount / 100);
  }

  // best-deal-wins: customer never pays more than the sum of current promos.
  const finalPriceRaw = Math.min(bundleFinalPrice, effectivePromoPrice);
  const finalPrice = Math.round(finalPriceRaw * 100) / 100;
  const appliedRule: 'bundle' | 'promo' = finalPriceRaw === bundleFinalPrice ? 'bundle' : 'promo';

  return {
    originalPrice: Math.round(originalPrice * 100) / 100,
    effectivePromoPrice: Math.round(effectivePromoPrice * 100) / 100,
    finalPrice,
    savings: Math.round((originalPrice - finalPrice) * 100) / 100,
    appliedRule,
  };
}

export async function addBundleToCart(userId: number, bundleId: number) {
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId, isActive: true },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, isActive: true, quantity: true },
          },
        },
      },
    },
  });

  if (!bundle) throw new BundleError('Комплект не знайдено або неактивний', 404);

  // Pre-flight validation of EVERY item before mutating the cart. Without
  // this, a stock failure on item N left items 1..N-1 already added — the
  // customer ended up with a half-bundle in their cart and no clear signal
  // why. Validate first, mutate second.
  for (const item of bundle.items) {
    if (!item.product.isActive) {
      throw new BundleError(`Товар "${item.product.name}" у комплекті недоступний`, 400);
    }
    if (item.product.quantity < item.quantity) {
      throw new BundleError(
        `Недостатньо «${item.product.name}» на складі: потрібно ${item.quantity}, є ${item.product.quantity}`,
        409,
      );
    }
  }

  const results = [];
  for (const item of bundle.items) {
    const cartItem = await addToCart(userId, item.productId, item.quantity);
    results.push(cartItem);
  }

  return results;
}

export interface BundleDiscountCartItem {
  productId: number;
  /** Ціна, яку клієнт реально платить за одиницю (tier/personal/promo вже враховано). */
  price: number;
  quantity: number;
}

export interface AppliedBundleDiscount {
  bundleId: number;
  name: string;
  /** Скільки повних комплектів знайдено в кошику. */
  sets: number;
  /** Сумарна знижка за всі комплекти цього бандла. */
  discount: number;
}

/**
 * Авто-детект комплектів у кошику: якщо кошик містить усі позиції активного
 * бандла в потрібних кількостях — клієнт отримує бандл-знижку, навіть якщо
 * зібрав набір вручну з каталогу. Це і робить вітринну ціну набору правдою:
 * createOrder викликає цю функцію і зменшує суму товарів на totalDiscount.
 *
 * Знижка за один комплект = (що клієнт платить за ці позиції зараз) −
 * (фінальна ціна бандла за best-deal-wins з calculateBundlePrice), клампнута
 * в ≥0 — тож оптовик із цінами нижче бандлових просто не отримує нічого
 * зверху, без подвійних знижок.
 *
 * Бандли, що перетинаються товарами, не стакаються по тих самих одиницях:
 * жадібно застосовуємо найвигідніший, споживаючи кількості з кошика.
 */
export async function detectBundleDiscounts(
  cartItems: BundleDiscountCartItem[],
): Promise<{ totalDiscount: number; applied: AppliedBundleDiscount[] }> {
  if (cartItems.length === 0) return { totalDiscount: 0, applied: [] };

  const bundles = await prisma.bundle.findMany({
    where: { isActive: true },
    include: {
      items: {
        include: {
          product: { select: { priceRetail: true, priceRetailOld: true, isPromo: true } },
        },
      },
    },
  });
  if (bundles.length === 0) return { totalDiscount: 0, applied: [] };

  // Залишки кошика: id → {qty, price}; дублікати productId зливаємо.
  const remaining = new Map<number, { quantity: number; price: number }>();
  for (const item of cartItems) {
    const prev = remaining.get(item.productId);
    if (prev) prev.quantity += item.quantity;
    else remaining.set(item.productId, { quantity: item.quantity, price: item.price });
  }

  const candidates = bundles
    .map((bundle) => {
      if (bundle.items.length === 0) return null;

      // Та сама цінова логіка, що в calculateBundlePrice (originalPrice →
      // fixedPrice/discountPercent → best-deal-wins проти суми поточних промо).
      let originalPrice = 0;
      let effectivePromoPrice = 0;
      for (const item of bundle.items) {
        const base =
          item.product.isPromo && item.product.priceRetailOld
            ? Number(item.product.priceRetailOld)
            : Number(item.product.priceRetail);
        originalPrice = addMoney(originalPrice, lineTotal(base, item.quantity));
        effectivePromoPrice = addMoney(
          effectivePromoPrice,
          lineTotal(Number(item.product.priceRetail), item.quantity),
        );
      }
      const nominal = bundle.fixedPrice
        ? Number(bundle.fixedPrice)
        : subtractMoney(originalPrice, percentOf(originalPrice, Number(bundle.discountPercent)));
      const bundleFinalPrice = minMoney(nominal, effectivePromoPrice);

      return { bundle, bundleFinalPrice };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const applied: AppliedBundleDiscount[] = [];
  let totalDiscount = 0;

  // Жадібний порядок: спершу рахуємо потенційну знижку за один комплект із
  // ПОВНОГО кошика, сортуємо за нею і застосовуємо, споживаючи залишки.
  const discountPerSetOf = (c: (typeof candidates)[number]): number => {
    let cartCost = 0;
    for (const item of c.bundle.items) {
      const inCart = remaining.get(item.productId);
      if (!inCart || inCart.quantity < item.quantity) return 0;
      cartCost = addMoney(cartCost, lineTotal(inCart.price, item.quantity));
    }
    return maxMoney(0, subtractMoney(cartCost, c.bundleFinalPrice));
  };

  candidates.sort((a, b) => discountPerSetOf(b) - discountPerSetOf(a));

  for (const candidate of candidates) {
    const perSet = discountPerSetOf(candidate);
    if (perSet <= 0) continue;

    let sets = Infinity;
    for (const item of candidate.bundle.items) {
      const inCart = remaining.get(item.productId);
      sets = Math.min(sets, inCart ? Math.floor(inCart.quantity / item.quantity) : 0);
    }
    if (sets <= 0 || !Number.isFinite(sets)) continue;

    for (const item of candidate.bundle.items) {
      const inCart = remaining.get(item.productId)!;
      inCart.quantity -= item.quantity * sets;
    }

    const discount = round2(perSet * sets);
    applied.push({
      bundleId: candidate.bundle.id,
      name: candidate.bundle.name,
      sets,
      discount,
    });
    totalDiscount = addMoney(totalDiscount, discount);
  }

  return { totalDiscount, applied };
}
