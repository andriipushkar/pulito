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

/**
 * Manager scoping: a `manager` may only see/touch personal prices belonging to
 * customers assigned to them (`User.assignedManagerId`). Pass the manager's own
 * id as `managerScopeId`; pass `null`/`undefined` for `admin` (no restriction).
 */
async function assertManagerOwnsCustomer(
  managerScopeId: number | null | undefined,
  customerUserId: number,
) {
  if (managerScopeId == null) return;
  const customer = await prisma.user.findUnique({
    where: { id: customerUserId },
    select: { assignedManagerId: true },
  });
  if (!customer || customer.assignedManagerId !== managerScopeId) {
    throw new PersonalPriceError('Цей клієнт не закріплений за вами', 403);
  }
}

export async function getPersonalPrices(
  filters: PersonalPriceFilterInput,
  managerScopeId?: number | null,
) {
  const where: Prisma.PersonalPriceWhereInput = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.categoryId) where.categoryId = filters.categoryId;

  // Restrict a manager to their assigned customers' prices.
  if (managerScopeId != null) {
    where.user = { assignedManagerId: managerScopeId };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [rows, total] = await Promise.all([
    prisma.personalPrice.findMany({
      where,
      select: personalPriceSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
    }),
    prisma.personalPrice.count({ where }),
  ]);

  // PersonalPrice stores only a scalar categoryId (no relation), so resolve the
  // category names in one batched query and attach them — the admin list shows
  // the name instead of a bare id.
  const categoryIds = [
    ...new Set(rows.map((r) => r.categoryId).filter((id): id is number => id != null)),
  ];
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const items = rows.map((r) => ({
    ...r,
    category: r.categoryId != null ? (categoryById.get(r.categoryId) ?? null) : null,
  }));

  return { items, total };
}

export async function createPersonalPrice(
  data: CreatePersonalPriceInput & { stackableWith?: string[] },
  createdBy: number,
  managerScopeId?: number | null,
) {
  await assertManagerOwnsCustomer(managerScopeId, data.userId);

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
  managerScopeId?: number | null,
) {
  const existing = await prisma.personalPrice.findUnique({ where: { id } });
  if (!existing) {
    throw new PersonalPriceError('Персональну ціну не знайдено', 404);
  }
  await assertManagerOwnsCustomer(managerScopeId, existing.userId);

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

export async function deletePersonalPrice(id: number, managerScopeId?: number | null) {
  const existing = await prisma.personalPrice.findUnique({ where: { id } });
  if (!existing) {
    throw new PersonalPriceError('Персональну ціну не знайдено', 404);
  }
  await assertManagerOwnsCustomer(managerScopeId, existing.userId);

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
