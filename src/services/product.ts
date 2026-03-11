import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import type { ProductFilterInput } from '@/validators/product';
import type { ProductListItem } from '@/types/product';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL } from '@/services/cache';

/**
 * Full-text search with three-level ranking:
 * 1. Exact code match (highest priority)
 * 2. tsvector full-text search with ts_rank_cd
 * 3. Trigram similarity for fuzzy matching
 */
interface SearchFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  promo?: boolean;
  inStock?: boolean;
}

/**
 * Build parameterized WHERE conditions for full-text search.
 * All dynamic values are passed as numbered $N placeholders.
 */
function buildSearchConditions(
  filters: SearchFilters,
  startParam: number
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = startParam;

  if (filters.category) {
    conditions.push(`category_id IN (SELECT id FROM categories WHERE slug = $${idx})`);
    params.push(filters.category);
    idx++;
  }
  if (filters.priceMin !== undefined) {
    conditions.push(`price_retail >= $${idx}`);
    params.push(filters.priceMin);
    idx++;
  }
  if (filters.priceMax !== undefined) {
    conditions.push(`price_retail <= $${idx}`);
    params.push(filters.priceMax);
    idx++;
  }
  if (filters.promo) {
    conditions.push(`is_promo = true`);
  }
  if (filters.inStock) {
    conditions.push(`quantity > 0`);
  }

  return {
    sql: conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function fullTextSearchProductIds(
  query: string,
  limit: number,
  offset: number,
  filters: SearchFilters
): Promise<{ ids: number[]; total: number }> {
  const likePattern = `%${query}%`;

  // Base search params: $1=likePattern, $2=query, $3=query
  // Extra filter params start from $4
  const { sql: filterSql, params: filterParams } = buildSearchConditions(filters, 4);

  const countSql = `
    SELECT COUNT(DISTINCT id)::bigint as count FROM (
      SELECT id FROM products
      WHERE is_active = true ${filterSql}
        AND (
          code ILIKE $1
          OR search_vector @@ plainto_tsquery('simple', $2)
          OR similarity(name, $3) > 0.2
        )
    ) sub
  `;

  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    countSql, likePattern, query, query, ...filterParams
  );

  const total = Number(countResult[0]?.count ?? 0);

  if (total === 0) return { ids: [], total: 0 };

  // Rank query: $1=like, $2=query, $3=query, $4=like, $5=query, $6=query
  // Extra filter params start from $7
  const { sql: rankFilterSql, params: rankFilterParams } = buildSearchConditions(filters, 7);
  const limitIdx = 7 + rankFilterParams.length;
  const offsetIdx = limitIdx + 1;

  const rankSql = `
    SELECT id,
      CASE WHEN code ILIKE $1 THEN 100 ELSE 0 END
      + COALESCE(ts_rank_cd(search_vector, plainto_tsquery('simple', $2)) * 10, 0)
      + COALESCE(similarity(name, $3) * 5, 0)
      AS rank
    FROM products
    WHERE is_active = true ${rankFilterSql}
      AND (
        code ILIKE $4
        OR search_vector @@ plainto_tsquery('simple', $5)
        OR similarity(name, $6) > 0.2
      )
    ORDER BY rank DESC, orders_count DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const results = await prisma.$queryRawUnsafe<{ id: number }[]>(
    rankSql, likePattern, query, query, likePattern, query, query,
    ...rankFilterParams, limit, offset
  );

  return { ids: results.map((r) => r.id), total };
}

export class ProductError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ProductError';
  }
}

/** Convert Prisma Decimal fields to plain numbers for Server→Client serialization */
function serializeProduct<T extends Record<string, unknown>>(product: T): T {
  const result = { ...product };
  for (const key of ['priceRetail', 'priceWholesale', 'priceWholesale2', 'priceWholesale3', 'priceRetailOld', 'priceWholesaleOld', 'priceWholesaleOld2', 'priceWholesaleOld3'] as const) {
    if (key in result && result[key] != null) {
      (result as Record<string, unknown>)[key] = Number(result[key]);
    }
  }
  return result;
}

function serializeProducts<T extends Record<string, unknown>>(products: T[]): T[] {
  return products.map(serializeProduct);
}

// Fields to select for product list (without heavy content)
const productListSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  priceRetail: true,
  priceWholesale: true,
  priceWholesale2: true,
  priceWholesale3: true,
  priceRetailOld: true,
  priceWholesaleOld: true,
  quantity: true,
  isPromo: true,
  isActive: true,
  imagePath: true,
  viewsCount: true,
  ordersCount: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parent: { select: { name: true, slug: true } },
    },
  },
  badges: {
    select: { id: true, badgeType: true, customText: true, customColor: true, priority: true },
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  },
  images: {
    select: { id: true, pathFull: true, pathMedium: true, pathThumbnail: true, pathBlur: true, isMain: true },
    orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
  },
  content: {
    select: { shortDescription: true },
  },
} satisfies Prisma.ProductSelect;

// Full product detail select (for single product page)
const productDetailSelect = {
  ...productListSelect,
  sortOrder: true,
  promoStartDate: true,
  promoEndDate: true,
  updatedAt: true,
  content: {
    select: {
      shortDescription: true,
      fullDescription: true,
      specifications: true,
      usageInstructions: true,
      videoUrl: true,
      seoTitle: true,
      seoDescription: true,
      isFilled: true,
    },
  },
  images: {
    select: {
      id: true,
      pathOriginal: true,
      pathFull: true,
      pathMedium: true,
      pathThumbnail: true,
      pathBlur: true,
      isMain: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
  badges: {
    select: { id: true, badgeType: true, customText: true, customColor: true, priority: true },
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      seoTitle: true,
      seoDescription: true,
      parent: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.ProductSelect;

function buildSortOrder(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ priceRetail: 'asc' }];
    case 'price_desc':
      return [{ priceRetail: 'desc' }];
    case 'name_asc':
      return [{ name: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'popular':
    default:
      return [{ ordersCount: 'desc' }, { viewsCount: 'desc' }];
  }
}

/**
 * @description Отримує список товарів з пагінацією та фільтрами. Використовує повнотекстовий пошук або Prisma-запити.
 * @param filters - Фільтри (пошук, категорія, ціна, акції, наявність, сортування, пагінація)
 * @returns Об'єкт зі списком товарів та загальною кількістю
 */
export async function getProducts(filters: ProductFilterInput) {
  const cacheKey = `products:list:${JSON.stringify(filters)}`;
  const cached = await cacheGet<{ products: ProductListItem[]; total: number }>(cacheKey);
  if (cached) return cached;

  const skip = (filters.page - 1) * filters.limit;

  // Use full-text search when search query is provided
  if (filters.search && filters.search.length >= 2) {
    const { ids, total } = await fullTextSearchProductIds(filters.search, filters.limit, skip, {
      category: filters.category,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      promo: filters.promo,
      inStock: filters.inStock,
    });

    if (ids.length === 0) return { products: [], total: 0 };

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: productListSelect,
    });

    // Preserve ranking order from full-text search
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    products.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    const result = { products: serializeProducts(products), total };
    await cacheSet(cacheKey, result, CACHE_TTL.MEDIUM);
    return result;
  }

  // Standard Prisma query for non-search filters
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.priceRetail = {};
    if (filters.priceMin !== undefined) {
      where.priceRetail.gte = filters.priceMin;
    }
    if (filters.priceMax !== undefined) {
      where.priceRetail.lte = filters.priceMax;
    }
  }

  if (filters.promo) {
    where.isPromo = true;
  }

  if (filters.inStock) {
    where.quantity = { gt: 0 };
  }

  const orderBy = buildSortOrder(filters.sort);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productListSelect,
      orderBy,
      skip,
      take: filters.limit,
    }),
    prisma.product.count({ where }),
  ]);

  const result = { products: serializeProducts(products), total };
  await cacheSet(cacheKey, result, CACHE_TTL.MEDIUM);
  return result;
}

/**
 * Apply personal pricing for an authenticated user.
 * Returns personalPrice field if a personal price exists, otherwise null.
 */
export async function applyPersonalPricing(
  product: { id: number; priceRetail: unknown; categoryId?: number | null; category?: { id: number } | null },
  userId: number | null
): Promise<number | null> {
  if (!userId) return null;

  const { getEffectivePrice } = await import('@/services/personal-price');
  const categoryId = product.categoryId ?? product.category?.id ?? null;
  const effective = await getEffectivePrice(userId, product.id, categoryId);

  if (!effective) return null;

  if (effective.fixedPrice !== null) {
    return effective.fixedPrice;
  }

  if (effective.discountPercent !== null) {
    const retail = Number(product.priceRetail);
    return Math.round(retail * (1 - effective.discountPercent / 100) * 100) / 100;
  }

  return null;
}

/**
 * @description Отримує товар за slug з кешуванням, збільшує лічильник переглядів та застосовує персональні ціни.
 * @param slug - URL-slug товару
 * @param userId - Ідентифікатор користувача для персональних цін (опціонально)
 * @returns Товар з деталями та персональною ціною або null
 */
export async function getProductBySlug(slug: string, userId?: number | null) {
  const cacheKey = `products:slug:${slug}`;

  const fetchFromDb = () =>
    prisma.product.findUnique({
      where: { slug, isActive: true },
      select: { ...productDetailSelect, categoryId: true },
    });

  type ProductResult = NonNullable<Awaited<ReturnType<typeof fetchFromDb>>>;

  const cached = await cacheGet<ProductResult>(cacheKey);
  const product = cached ?? await fetchFromDb();

  if (!product) return null;
  if (!cached) await cacheSet(cacheKey, product, CACHE_TTL.LONG);

  // Increment view count asynchronously
  prisma.product
    .update({ where: { id: product.id }, data: { viewsCount: { increment: 1 } } })
    .catch(() => {});

  const personalPrice = await applyPersonalPricing(product, userId ?? null);

  return serializeProduct({ ...product, personalPrice });
}

/**
 * @description Отримує товар за ID із застосуванням персональних цін.
 * @param id - Ідентифікатор товару
 * @param userId - Ідентифікатор користувача для персональних цін (опціонально)
 * @returns Товар з деталями та персональною ціною або null
 */
export async function getProductById(id: number, userId?: number | null) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { ...productDetailSelect, categoryId: true },
  });

  if (!product) return null;

  const personalPrice = await applyPersonalPricing(product, userId ?? null);

  return serializeProduct({ ...product, personalPrice });
}

/**
 * @description Автодоповнення пошуку товарів та категорій за текстовим запитом.
 * @param query - Пошуковий запит
 * @returns Об'єкт зі списком товарів та категорій, що відповідають запиту
 */
export async function searchAutocomplete(query: string) {
  const cacheKey = `products:autocomplete:${query.toLowerCase().trim()}`;
  const cached = await cacheGet<{ products: unknown[]; categories: unknown[] }>(cacheKey);
  if (cached) return cached;

  // Use full-text search for autocomplete: exact code → tsvector → trigram
  const productIds = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id,
      CASE WHEN code ILIKE ${`%${query}%`} THEN 100 ELSE 0 END
      + COALESCE(ts_rank_cd(search_vector, plainto_tsquery('simple', ${query})) * 10, 0)
      + COALESCE(similarity(name, ${query}) * 5, 0)
      AS rank
    FROM products
    WHERE is_active = true
      AND (
        code ILIKE ${`%${query}%`}
        OR search_vector @@ plainto_tsquery('simple', ${query})
        OR similarity(name, ${query}) > 0.2
      )
    ORDER BY rank DESC, orders_count DESC
    LIMIT 5
  `;

  const ids = productIds.map((r) => r.id);

  const [products, categories] = await Promise.all([
    ids.length > 0
      ? prisma.product.findMany({
          where: { id: { in: ids } },
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
            imagePath: true,
            images: {
              select: { pathThumbnail: true },
              where: { isMain: true },
              take: 1,
            },
          },
        }).then((prods) => {
          const idOrder = new Map(ids.map((id, i) => [id, i]));
          return prods.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
        })
      : Promise.resolve([]),
    prisma.category.findMany({
      where: {
        isVisible: true,
        name: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
      take: 3,
    }),
  ]);

  const result = { products: serializeProducts(products), categories };
  await cacheSet(cacheKey, result, CACHE_TTL.SHORT);
  return result;
}

/**
 * @description Створює новий товар з генерацією slug та перевіркою унікальності коду.
 * @param data - Дані товару (код, назва, категорія, ціни, кількість, статуси)
 * @returns Створений товар з деталями
 */
export async function createProduct(data: {
  code: string;
  name: string;
  categoryId?: number | null;
  priceRetail: number;
  priceWholesale?: number | null;
  priceWholesale2?: number | null;
  priceWholesale3?: number | null;
  quantity?: number;
  isPromo?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}) {
  const existing = await prisma.product.findUnique({ where: { code: data.code } });
  if (existing) {
    throw new ProductError('Товар з таким кодом вже існує', 409);
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new ProductError('Категорію не знайдено', 404);
    }
  }

  const slug = createSlug(data.name);
  let finalSlug = slug;
  const slugExists = await prisma.product.findUnique({ where: { slug } });
  if (slugExists) {
    finalSlug = `${slug}-${data.code.toLowerCase()}`;
  }

  const created = await prisma.product.create({
    data: {
      code: data.code,
      name: data.name,
      slug: finalSlug,
      categoryId: data.categoryId ?? null,
      priceRetail: data.priceRetail,
      priceWholesale: data.priceWholesale ?? null,
      priceWholesale2: data.priceWholesale2 ?? null,
      priceWholesale3: data.priceWholesale3 ?? null,
      quantity: data.quantity ?? 0,
      isPromo: data.isPromo ?? false,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
    select: productDetailSelect,
  });
  await cacheInvalidate('products:*');
  return created;
}

/**
 * @description Оновлює товар з відстеженням історії цін та перегенерацією slug при зміні назви.
 * @param id - Ідентифікатор товару
 * @param data - Дані для оновлення (код, назва, категорія, ціни, кількість, статуси)
 * @returns Оновлений товар з деталями
 */
export async function updateProduct(
  id: number,
  data: {
    code?: string;
    name?: string;
    categoryId?: number | null;
    priceRetail?: number;
    priceWholesale?: number | null;
    priceWholesale2?: number | null;
    priceWholesale3?: number | null;
    quantity?: number;
    isPromo?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new ProductError('Товар не знайдено', 404);
  }

  if (data.code && data.code !== product.code) {
    const codeExists = await prisma.product.findUnique({ where: { code: data.code } });
    if (codeExists) {
      throw new ProductError('Товар з таким кодом вже існує', 409);
    }
  }

  if (data.categoryId !== undefined && data.categoryId !== null) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new ProductError('Категорію не знайдено', 404);
    }
  }

  // Track price changes
  const updateData: Prisma.ProductUpdateInput = {};

  if (data.priceRetail !== undefined && Number(product.priceRetail) !== data.priceRetail) {
    updateData.priceRetailOld = product.priceRetail;
    updateData.priceRetail = data.priceRetail;

    // Save to price history
    await prisma.priceHistory.create({
      data: {
        productId: id,
        priceRetailOld: product.priceRetail,
        priceRetailNew: data.priceRetail,
        priceWholesaleOld: product.priceWholesale,
        priceWholesaleNew: data.priceWholesale ?? product.priceWholesale,
      },
    });
  } else if (data.priceRetail !== undefined) {
    updateData.priceRetail = data.priceRetail;
  }

  if (data.priceWholesale !== undefined && Number(product.priceWholesale) !== data.priceWholesale) {
    updateData.priceWholesaleOld = product.priceWholesale;
    updateData.priceWholesale = data.priceWholesale;
  } else if (data.priceWholesale !== undefined) {
    updateData.priceWholesale = data.priceWholesale;
  }

  if (data.priceWholesale2 !== undefined && Number(product.priceWholesale2) !== data.priceWholesale2) {
    updateData.priceWholesaleOld2 = product.priceWholesale2;
    updateData.priceWholesale2 = data.priceWholesale2;
  } else if (data.priceWholesale2 !== undefined) {
    updateData.priceWholesale2 = data.priceWholesale2;
  }

  if (data.priceWholesale3 !== undefined && Number(product.priceWholesale3) !== data.priceWholesale3) {
    updateData.priceWholesaleOld3 = product.priceWholesale3;
    updateData.priceWholesale3 = data.priceWholesale3;
  } else if (data.priceWholesale3 !== undefined) {
    updateData.priceWholesale3 = data.priceWholesale3;
  }

  if (data.name !== undefined) {
    updateData.name = data.name;
    if (data.name !== product.name) {
      const slug = createSlug(data.name);
      const slugExists = await prisma.product.findFirst({
        where: { slug, id: { not: id } },
      });
      const newSlug = slugExists ? `${slug}-${product.code.toLowerCase()}` : slug;
      updateData.slug = newSlug;

      // Auto-create redirect from old slug to new slug
      if (product.slug !== newSlug) {
        await prisma.slugRedirect.upsert({
          where: { oldSlug: product.slug },
          update: { newSlug, type: 'product' },
          create: { oldSlug: product.slug, newSlug, type: 'product' },
        });
      }
    }
  }

  if (data.code !== undefined) updateData.code = data.code;
  if (data.categoryId !== undefined) {
    updateData.category = data.categoryId
      ? { connect: { id: data.categoryId } }
      : { disconnect: true };
  }
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.isPromo !== undefined) updateData.isPromo = data.isPromo;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
    select: productDetailSelect,
  });
  await cacheInvalidate('products:*');
  return updated;
}

/**
 * @description М'яке видалення товару (встановлює isActive=false).
 * @param id - Ідентифікатор товару
 * @returns void
 */
export async function deleteProduct(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new ProductError('Товар не знайдено', 404);
  }

  // Soft delete - deactivate
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });
  await cacheInvalidate('products:*');
}

/**
 * @description Отримує акційні товари, відсортовані за популярністю.
 * @param limit - Максимальна кількість товарів (за замовчуванням 10)
 * @returns Масив акційних товарів
 */
export async function getPromoProducts(limit = 10) {
  const products = await prisma.product.findMany({
    where: { isActive: true, isPromo: true, quantity: { gt: 0 } },
    select: productListSelect,
    orderBy: { ordersCount: 'desc' },
    take: limit,
  });
  return serializeProducts(products);
}

/**
 * @description Отримує найновіші товари за датою створення.
 * @param limit - Максимальна кількість товарів (за замовчуванням 10)
 * @returns Масив нових товарів
 */
export async function getNewProducts(limit = 10) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: productListSelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return serializeProducts(products);
}

/**
 * @description Отримує найпопулярніші товари за кількістю замовлень (ordersCount).
 * @param limit - Максимальна кількість товарів (за замовчуванням 10)
 * @returns Масив популярних товарів
 */
export async function getPopularProducts(limit = 10) {
  const products = await prisma.product.findMany({
    where: { isActive: true, quantity: { gt: 0 } },
    select: productListSelect,
    orderBy: { ordersCount: 'desc' },
    take: limit,
  });
  return serializeProducts(products);
}
