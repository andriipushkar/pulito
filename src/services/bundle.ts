import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { addToCart } from '@/services/cart';

export class BundleError extends Error {
  constructor(
    message: string,
    public statusCode: number
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
    bundleType: 'curated' | 'custom';
    discountPercent?: number;
    fixedPrice?: number | null;
    imagePath?: string;
    items: { productId: number; quantity: number }[];
  },
  createdBy: number
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
    bundleType?: 'curated' | 'custom';
    discountPercent?: number;
    fixedPrice?: number | null;
    imagePath?: string;
    items?: { productId: number; quantity: number }[];
  }
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
    const base = item.product.isPromo && item.product.priceRetailOld
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
  const appliedRule: 'bundle' | 'promo' =
    finalPriceRaw === bundleFinalPrice ? 'bundle' : 'promo';

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
          product: { select: { id: true, isActive: true, quantity: true } },
        },
      },
    },
  });

  if (!bundle) throw new BundleError('Комплект не знайдено або неактивний', 404);

  const results = [];
  for (const item of bundle.items) {
    if (!item.product.isActive) {
      throw new BundleError(
        `Товар ID ${item.productId} у комплекті недоступний`,
        400
      );
    }
    const cartItem = await addToCart(userId, item.productId, item.quantity);
    results.push(cartItem);
  }

  return results;
}
