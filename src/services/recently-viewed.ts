import { prisma } from '@/lib/prisma';

export async function addRecentlyViewed(userId: number, productId: number) {
  await prisma.recentlyViewed.upsert({
    where: { userId_productId: { userId, productId } },
    update: { viewedAt: new Date() },
    create: { userId, productId },
  });
}

export async function getRecentlyViewed(userId: number, limit = 15) {
  return prisma.recentlyViewed.findMany({
    where: { userId },
    orderBy: { viewedAt: 'desc' },
    take: limit,
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
          priceRetailOld: true,
          quantity: true,
          isPromo: true,
          imagePath: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      },
    },
  });
}

export async function clearRecentlyViewed(userId: number) {
  await prisma.recentlyViewed.deleteMany({ where: { userId } });
}

// Merge a guest's localStorage history into the account on login. Filters to
// products that still exist (otherwise the FK upsert throws) and caps the batch.
export async function mergeRecentlyViewed(userId: number, productIds: number[]) {
  const ids = Array.from(new Set(productIds)).slice(0, 50);
  if (ids.length === 0) return;

  const existing = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const validIds = existing.map((p) => p.id);
  if (validIds.length === 0) return;

  await prisma.$transaction(
    validIds.map((productId) =>
      prisma.recentlyViewed.upsert({
        where: { userId_productId: { userId, productId } },
        update: { viewedAt: new Date() },
        create: { userId, productId },
      }),
    ),
  );
}
