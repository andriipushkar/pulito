import { prisma } from '@/lib/prisma';
import { redis, CACHE_TTL } from '@/lib/redis';

const CACHE_PREFIX = 'rec:';
const PERSONAL_CACHE_PREFIX = 'rec:personal:';

/** Shared product select fields for recommendation queries. */
const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  code: true,
  priceRetail: true,
  imagePath: true,
  isPromo: true,
  isActive: true,
  images: {
    select: { pathThumbnail: true },
    where: { isMain: true },
    take: 1,
  },
} as const;

/**
 * Get product recommendations (manual + algorithmic).
 */
export async function getRecommendations(
  productId: number,
  limit = 8,
): Promise<
  {
    id: number;
    name: string;
    slug: string;
    code: string;
    priceRetail: unknown;
    imagePath: string | null;
    isPromo: boolean;
    images: { pathThumbnail: string | null }[];
  }[]
> {
  const cacheKey = `${CACHE_PREFIX}${productId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 1. Manual recommendations first
  const manual = await prisma.productRecommendation.findMany({
    where: { productId, recommendationType: 'manual' },
    orderBy: { score: 'desc' },
    take: limit,
    select: {
      recommendedProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          priceRetail: true,
          imagePath: true,
          isPromo: true,
          isActive: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      },
    },
  });

  const manualProducts = manual.map((r) => r.recommendedProduct).filter((p) => p.isActive);

  if (manualProducts.length >= limit) {
    const result = manualProducts.slice(0, limit);
    await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(result));
    return result;
  }

  // 2. Fill with "bought_together" and "similar"
  const existingIds = manualProducts.map((p) => p.id);
  const auto = await prisma.productRecommendation.findMany({
    where: {
      productId,
      recommendationType: { in: ['bought_together', 'similar'] },
      recommendedProductId: { notIn: [...existingIds, productId] },
    },
    orderBy: { score: 'desc' },
    take: limit - manualProducts.length,
    select: {
      recommendedProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          priceRetail: true,
          imagePath: true,
          isPromo: true,
          isActive: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      },
    },
  });

  const autoProducts = auto.map((r) => r.recommendedProduct).filter((p) => p.isActive);

  const combined = [...manualProducts, ...autoProducts];

  // 3. If still not enough, fill with same-category products
  if (combined.length < limit) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });

    if (product?.categoryId) {
      const allIds = [...combined.map((p) => p.id), productId];
      const categoryProducts = await prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          isActive: true,
          id: { notIn: allIds },
        },
        orderBy: { ordersCount: 'desc' },
        take: limit - combined.length,
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          priceRetail: true,
          imagePath: true,
          isPromo: true,
          isActive: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      });
      combined.push(...categoryProducts);
    }
  }

  const result = combined.slice(0, limit);
  await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(result));
  return result;
}

/**
 * Build "bought_together" recommendations from order history.
 * Should run as a periodic job.
 */
export async function buildBoughtTogetherRecommendations(): Promise<number> {
  // Get recent orders with 2+ items
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['completed', 'shipped', 'paid'] },
      itemsCount: { gte: 2 },
    },
    select: {
      items: { select: { productId: true } },
    },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  });

  const pairCounts = new Map<string, number>();

  for (const order of orders) {
    const ids = order.items.map((i) => i.productId);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join(':');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  let created = 0;
  for (const [key, count] of pairCounts) {
    if (count < 2) continue; // min 2 co-occurrences
    const [a, b] = key.split(':').map(Number);

    // Upsert both directions
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const existing = await prisma.productRecommendation.findFirst({
        where: {
          productId: from,
          recommendedProductId: to,
          recommendationType: 'bought_together',
        },
      });

      if (existing) {
        await prisma.productRecommendation.update({
          where: { id: existing.id },
          data: { score: count },
        });
      } else {
        await prisma.productRecommendation.create({
          data: {
            productId: from,
            recommendedProductId: to,
            recommendationType: 'bought_together',
            score: count,
          },
        });
      }
      created++;
    }
  }

  return created;
}

/**
 * Build collaborative filtering recommendations using Jaccard similarity.
 * Algorithm:
 * 1. Get last N orders (e.g., 5000) with their items
 * 2. Build user→products purchase map
 * 3. For each product pair, calculate co-purchase score:
 *    score = |users_who_bought_A ∩ users_who_bought_B| / |users_who_bought_A ∪ users_who_bought_B|
 * 4. Store top recommendations per product as ProductRecommendation with type 'collaborative'
 */
export async function buildCollaborativeRecommendations(options?: {
  maxOrders?: number;
  minScore?: number;
  maxRecsPerProduct?: number;
}): Promise<number> {
  const maxOrders = options?.maxOrders ?? 5000;
  const minScore = options?.minScore ?? 0.05;
  const maxRecsPerProduct = options?.maxRecsPerProduct ?? 10;

  // 1. Get recent orders with their items and user info
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['completed', 'shipped', 'paid'] },
      userId: { not: null },
    },
    select: {
      userId: true,
      items: { select: { productId: true } },
    },
    take: maxOrders,
    orderBy: { createdAt: 'desc' },
  });

  // 2. Build user→products purchase map
  const userProducts = new Map<number, Set<number>>();
  for (const order of orders) {
    if (!order.userId) continue;
    const existing = userProducts.get(order.userId) ?? new Set<number>();
    for (const item of order.items) {
      if (item.productId !== null) existing.add(item.productId);
    }
    userProducts.set(order.userId, existing);
  }

  // 3. Build product→users reverse map
  const productUsers = new Map<number, Set<number>>();
  for (const [userId, products] of userProducts) {
    for (const productId of products) {
      const existing = productUsers.get(productId) ?? new Set<number>();
      existing.add(userId);
      productUsers.set(productId, existing);
    }
  }

  // 4. Calculate Jaccard similarity for each product pair
  const productIds = Array.from(productUsers.keys());
  // productId → array of { recommendedId, score } sorted desc
  const topRecs = new Map<number, { recommendedId: number; score: number }[]>();

  for (let i = 0; i < productIds.length; i++) {
    for (let j = i + 1; j < productIds.length; j++) {
      const a = productIds[i];
      const b = productIds[j];
      const usersA = productUsers.get(a)!;
      const usersB = productUsers.get(b)!;

      // Intersection
      let intersection = 0;
      for (const u of usersA) {
        if (usersB.has(u)) intersection++;
      }
      if (intersection === 0) continue;

      // Union = |A| + |B| - intersection
      const union = usersA.size + usersB.size - intersection;
      const score = intersection / union;

      if (score < minScore) continue;

      // Add to both product's recommendation lists
      for (const [from, to] of [
        [a, b],
        [b, a],
      ] as [number, number][]) {
        const recs = topRecs.get(from) ?? [];
        recs.push({ recommendedId: to, score });
        topRecs.set(from, recs);
      }
    }
  }

  // 5. Keep only top N per product
  for (const [productId, recs] of topRecs) {
    recs.sort((x, y) => y.score - x.score);
    topRecs.set(productId, recs.slice(0, maxRecsPerProduct));
  }

  // 6. Delete old collaborative recs and insert new ones in a transaction
  let created = 0;

  await prisma.$transaction(async (tx) => {
    await tx.productRecommendation.deleteMany({
      where: { recommendationType: 'collaborative' },
    });

    for (const [productId, recs] of topRecs) {
      for (const rec of recs) {
        await tx.productRecommendation.create({
          data: {
            productId,
            recommendedProductId: rec.recommendedId,
            recommendationType: 'collaborative',
            score: rec.score,
          },
        });
        created++;
      }
    }
  });

  return created;
}

/**
 * Get personalized recommendations for a user.
 * Combines: user's purchase history → collaborative recs → bought_together → similar → fallback
 */
export async function getPersonalizedRecommendations(
  userId: number,
  limit = 12,
): Promise<
  {
    id: number;
    name: string;
    slug: string;
    code: string;
    priceRetail: unknown;
    imagePath: string | null;
    isPromo: boolean;
    images: { pathThumbnail: string | null }[];
  }[]
> {
  const cacheKey = `${PERSONAL_CACHE_PREFIX}${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 1. Get products the user has already bought
  const userOrders = await prisma.order.findMany({
    where: {
      userId,
      status: { in: ['completed', 'shipped', 'paid'] },
    },
    select: {
      items: { select: { productId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const boughtProductIds = new Set<number>();
  for (const order of userOrders) {
    for (const item of order.items) {
      if (item.productId !== null) boughtProductIds.add(item.productId);
    }
  }

  const result: {
    id: number;
    name: string;
    slug: string;
    code: string;
    priceRetail: unknown;
    imagePath: string | null;
    isPromo: boolean;
    images: { pathThumbnail: string | null }[];
  }[] = [];
  const seenIds = new Set<number>();

  // 2. If user has purchase history, get collaborative recs based on their products
  if (boughtProductIds.size > 0) {
    const collaborativeRecs = await prisma.productRecommendation.findMany({
      where: {
        productId: { in: Array.from(boughtProductIds) },
        recommendationType: 'collaborative',
        recommendedProductId: { notIn: Array.from(boughtProductIds) },
      },
      orderBy: { score: 'desc' },
      take: limit,
      select: {
        recommendedProduct: { select: PRODUCT_SELECT },
      },
    });

    for (const rec of collaborativeRecs) {
      const p = rec.recommendedProduct;
      if (p.isActive && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        result.push(p);
      }
    }

    // 3. Fill with bought_together recs
    if (result.length < limit) {
      const excludeIds = [...Array.from(boughtProductIds), ...Array.from(seenIds)];
      const boughtTogether = await prisma.productRecommendation.findMany({
        where: {
          productId: { in: Array.from(boughtProductIds) },
          recommendationType: 'bought_together',
          recommendedProductId: { notIn: excludeIds },
        },
        orderBy: { score: 'desc' },
        take: limit - result.length,
        select: {
          recommendedProduct: { select: PRODUCT_SELECT },
        },
      });

      for (const rec of boughtTogether) {
        const p = rec.recommendedProduct;
        if (p.isActive && !seenIds.has(p.id)) {
          seenIds.add(p.id);
          result.push(p);
        }
      }
    }

    // 4. Fill with similar recs
    if (result.length < limit) {
      const excludeIds = [...Array.from(boughtProductIds), ...Array.from(seenIds)];
      const similar = await prisma.productRecommendation.findMany({
        where: {
          productId: { in: Array.from(boughtProductIds) },
          recommendationType: 'similar',
          recommendedProductId: { notIn: excludeIds },
        },
        orderBy: { score: 'desc' },
        take: limit - result.length,
        select: {
          recommendedProduct: { select: PRODUCT_SELECT },
        },
      });

      for (const rec of similar) {
        const p = rec.recommendedProduct;
        if (p.isActive && !seenIds.has(p.id)) {
          seenIds.add(p.id);
          result.push(p);
        }
      }
    }
  }

  // 5. Fallback: popular/trending products
  if (result.length < limit) {
    const excludeIds = [...Array.from(boughtProductIds), ...Array.from(seenIds)];
    const popular = await prisma.product.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeIds },
      },
      orderBy: { ordersCount: 'desc' },
      take: limit - result.length,
      select: PRODUCT_SELECT,
    });

    for (const p of popular) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        result.push(p);
      }
    }
  }

  const finalResult = result.slice(0, limit);
  await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(finalResult));
  return finalResult;
}
