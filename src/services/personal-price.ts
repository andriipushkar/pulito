import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import type {
  PersonalPriceFilterInput,
  CreatePersonalPriceInput,
  UpdatePersonalPriceInput,
} from '@/validators/personal-price';

export class PersonalPriceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PersonalPriceError';
  }
}

const personalPriceSelect = {
  id: true,
  userId: true,
  user: { select: { id: true, fullName: true, email: true } },
  productId: true,
  product: { select: { id: true, name: true, code: true } },
  categoryId: true,
  discountPercent: true,
  fixedPrice: true,
  validFrom: true,
  validUntil: true,
  createdBy: true,
  creator: { select: { id: true, fullName: true } },
  createdAt: true,
} satisfies Prisma.PersonalPriceSelect;

export async function getPersonalPrices(filters: PersonalPriceFilterInput) {
  const where: Prisma.PersonalPriceWhereInput = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.categoryId) where.categoryId = filters.categoryId;

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    prisma.personalPrice.findMany({
      where,
      select: personalPriceSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
    }),
    prisma.personalPrice.count({ where }),
  ]);

  return { items, total };
}

export async function createPersonalPrice(
  data: CreatePersonalPriceInput & { stackableWith?: string[] },
  createdBy: number,
) {
  // Idempotency-by-shape: a duplicate (userId, productId, categoryId) entry
  // means two rules compete for the same lookup, with `getEffectivePrice`
  // arbitrarily picking the first by createdAt. The DB has no unique
  // constraint (since (a,null,null) vs (a,2,null) are different shapes), so
  // we check explicitly here. Without this, double-submit creates a parallel
  // rule that admins later wonder why removing only one of them didn't
  // actually change the customer's price.
  const dupe = await prisma.personalPrice.findFirst({
    where: {
      userId: data.userId,
      productId: data.productId ?? null,
      categoryId: data.categoryId ?? null,
    },
    select: { id: true },
  });
  if (dupe) {
    throw new PersonalPriceError(
      `Для цього клієнта вже існує правило з тими ж productId/categoryId (id=${dupe.id}). Оновіть існуюче замість дублювання.`,
      409,
    );
  }

  return prisma.personalPrice.create({
    data: {
      userId: data.userId,
      productId: data.productId ?? null,
      categoryId: data.categoryId ?? null,
      discountPercent: data.discountPercent ?? null,
      fixedPrice: data.fixedPrice ?? null,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      // Persist the stacking rule so getEffectivePrice can return it.
      // Defaults to `[]` (= "does not stack with anything") at the DB level.
      stackableWith: data.stackableWith ?? [],
      createdBy,
    },
    select: personalPriceSelect,
  });
}

export async function updatePersonalPrice(
  id: number,
  data: UpdatePersonalPriceInput & { stackableWith?: string[] },
) {
  const existing = await prisma.personalPrice.findUnique({ where: { id } });
  if (!existing) {
    throw new PersonalPriceError('Персональну ціну не знайдено', 404);
  }

  return prisma.personalPrice.update({
    where: { id },
    data: {
      discountPercent: data.discountPercent ?? existing.discountPercent,
      fixedPrice: data.fixedPrice ?? existing.fixedPrice,
      validFrom:
        data.validFrom !== undefined
          ? data.validFrom
            ? new Date(data.validFrom)
            : null
          : existing.validFrom,
      validUntil:
        data.validUntil !== undefined
          ? data.validUntil
            ? new Date(data.validUntil)
            : null
          : existing.validUntil,
      ...(data.stackableWith !== undefined && { stackableWith: data.stackableWith }),
    },
    select: personalPriceSelect,
  });
}

export async function deletePersonalPrice(id: number) {
  const existing = await prisma.personalPrice.findUnique({ where: { id } });
  if (!existing) {
    throw new PersonalPriceError('Персональну ціну не знайдено', 404);
  }

  await prisma.personalPrice.delete({ where: { id } });
}

export async function getEffectivePrice(
  userId: number,
  productId: number,
  categoryId: number | null,
): Promise<{
  discountPercent: number | null;
  fixedPrice: number | null;
  stackableWith: string[];
} | null> {
  const now = new Date();

  // Product-specific price takes priority
  const productPrice = await prisma.personalPrice.findFirst({
    where: {
      userId,
      productId,
      OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }],
    },
    select: { discountPercent: true, fixedPrice: true, stackableWith: true },
  });

  if (productPrice) {
    return {
      discountPercent: productPrice.discountPercent ? Number(productPrice.discountPercent) : null,
      fixedPrice: productPrice.fixedPrice ? Number(productPrice.fixedPrice) : null,
      stackableWith: productPrice.stackableWith ?? [],
    };
  }

  // Category-level price
  if (categoryId) {
    const categoryPrice = await prisma.personalPrice.findFirst({
      where: {
        userId,
        categoryId,
        productId: null,
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }],
      },
      select: { discountPercent: true, fixedPrice: true, stackableWith: true },
    });

    if (categoryPrice) {
      return {
        discountPercent: categoryPrice.discountPercent
          ? Number(categoryPrice.discountPercent)
          : null,
        fixedPrice: categoryPrice.fixedPrice ? Number(categoryPrice.fixedPrice) : null,
        stackableWith: categoryPrice.stackableWith ?? [],
      };
    }
  }

  return null;
}
