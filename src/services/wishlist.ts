import { prisma } from '@/lib/prisma';

export class WishlistError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'WishlistError';
  }
}

const wishlistItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      priceRetail: true,
      priceWholesale: true,
      priceRetailOld: true,
      quantity: true,
      isPromo: true,
      isActive: true,
      imagePath: true,
      images: {
        select: { pathThumbnail: true },
        where: { isMain: true as const },
        take: 1,
      },
    },
  },
} as const;

export async function getOrCreateDefaultWishlist(userId: number) {
  const existing = await prisma.wishlist.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;
  return prisma.wishlist.create({
    data: { userId, name: 'Обране' },
  });
}

export async function resolveWishlistId(userId: number, idParam: string): Promise<number> {
  if (idParam === 'default') {
    const wishlist = await getOrCreateDefaultWishlist(userId);
    return wishlist.id;
  }
  const numId = Number(idParam);
  if (isNaN(numId)) throw new WishlistError('Невалідний ID', 400);
  return numId;
}

export async function isProductInWishlist(userId: number, wishlistId: number, productId: number): Promise<boolean> {
  const item = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId, productId } },
  });
  return !!item;
}

export async function getUserWishlists(userId: number) {
  return prisma.wishlist.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { items: true } },
      items: {
        orderBy: { addedAt: 'desc' },
        include: wishlistItemInclude,
      },
    },
  });
}

export async function getWishlistById(userId: number, wishlistId: number) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    include: {
      items: {
        orderBy: { addedAt: 'desc' },
        include: wishlistItemInclude,
      },
    },
  });

  if (!wishlist || wishlist.userId !== userId) {
    throw new WishlistError('Список не знайдено', 404);
  }

  return wishlist;
}

export async function createWishlist(userId: number, name: string) {
  return prisma.wishlist.create({
    data: { userId, name },
    include: {
      _count: { select: { items: true } },
      items: {
        orderBy: { addedAt: 'desc' },
        include: wishlistItemInclude,
      },
    },
  });
}

export async function updateWishlist(userId: number, wishlistId: number, name: string) {
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist || wishlist.userId !== userId) {
    throw new WishlistError('Список не знайдено', 404);
  }

  return prisma.wishlist.update({
    where: { id: wishlistId },
    data: { name },
  });
}

export async function deleteWishlist(userId: number, wishlistId: number) {
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist || wishlist.userId !== userId) {
    throw new WishlistError('Список не знайдено', 404);
  }

  await prisma.wishlist.delete({ where: { id: wishlistId } });
}

export async function addItemToWishlist(userId: number, wishlistId: number, productId: number) {
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist || wishlist.userId !== userId) {
    throw new WishlistError('Список не знайдено', 404);
  }

  const product = await prisma.product.findUnique({ where: { id: productId, isActive: true } });
  if (!product) throw new WishlistError('Товар не знайдено', 404);

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId, productId } },
  });
  if (existing) throw new WishlistError('Товар вже в списку', 409);

  return prisma.wishlistItem.create({
    data: { wishlistId, productId },
    include: wishlistItemInclude,
  });
}

export async function removeItemFromWishlist(userId: number, wishlistId: number, productId: number) {
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist || wishlist.userId !== userId) {
    throw new WishlistError('Список не знайдено', 404);
  }

  const item = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId, productId } },
  });
  if (!item) throw new WishlistError('Товар не знайдено в списку', 404);

  await prisma.wishlistItem.delete({
    where: { wishlistId_productId: { wishlistId, productId } },
  });
}
