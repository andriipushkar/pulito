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
