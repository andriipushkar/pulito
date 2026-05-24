import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { cacheInvalidate } from '@/services/cache';
import type { OneCProduct, OneCStockItem, OneCPriceItem } from '@/validators/integration-1c';

// ── 1C data interfaces ──────────────────────────────────────

export interface OneCOrder {
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMethod: string;
  deliveryAddress: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  items: OneCOrderItem[];
}

export interface OneCOrderItem {
  code: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface SyncResult {
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ code: string; message: string }>;
}

// ── Transforms ──────────────────────────────────────────────

/** Transform 1C product format to internal format */
export function transform1CProduct(data: OneCProduct) {
  return {
    code: data.code.trim(),
    name: data.name.trim(),
    slug: createSlug(data.name),
    priceRetail: data.priceRetail ?? 0,
    priceWholesale: data.priceWholesale ?? null,
    quantity: data.quantity ?? 0,
    isActive: data.isActive ?? true,
    weightGrams: data.weightGrams != null ? Math.round(data.weightGrams) : null,
    lengthMm: data.lengthMm ?? null,
    widthMm: data.widthMm ?? null,
    heightMm: data.heightMm ?? null,
    cost: data.cost ?? null,
  };
}

/** Transform internal order to 1C format */
export function transformOrderTo1C(order: {
  id: number;
  orderNumber: string;
  createdAt: Date;
  status: string;
  totalAmount: unknown;
  deliveryMethod: string | null;
  deliveryAddress: string | null;
  paymentMethod: string | null;
  user: { fullName: string; phone: string | null; email: string } | null;
  items: Array<{
    quantity: number;
    priceAtOrder?: unknown;
    price?: unknown;
    productCode?: string;
    productName?: string;
    product?: { code: string; name: string } | null;
  }>;
}): OneCOrder {
  return {
    orderNumber: order.orderNumber,
    date: order.createdAt.toISOString(),
    customerName: order.user?.fullName ?? '',
    customerPhone: order.user?.phone ?? '',
    customerEmail: order.user?.email,
    deliveryMethod: order.deliveryMethod ?? '',
    deliveryAddress: order.deliveryAddress ?? '',
    paymentMethod: order.paymentMethod ?? '',
    status: order.status,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => {
      const price = Number(item.priceAtOrder ?? item.price ?? 0);
      return {
        code: item.productCode ?? item.product?.code ?? '',
        name: item.productName ?? item.product?.name ?? '',
        quantity: item.quantity,
        price,
        total: item.quantity * price,
      };
    }),
  };
}

// ── Sync operations ─────────────────────────────────────────

/** Sync products from 1C — creates or updates products by code */
export async function importProductsFrom1C(products: OneCProduct[]): Promise<SyncResult> {
  const result: SyncResult = {
    total: products.length,
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  // Pre-fetch existing categories
  const existingCategories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  // Ukrainian-aware case fold so "Білизна" and "білизна" match.
  const categoryMap = new Map(
    existingCategories.map((c) => [c.name.toLocaleLowerCase('uk'), c.id]),
  );

  for (const product of products) {
    try {
      const data = transform1CProduct(product);

      // Resolve category
      let categoryId: number | null = null;
      if (product.category) {
        const existing = categoryMap.get(product.category.toLocaleLowerCase('uk'));
        if (existing) {
          categoryId = existing;
        } else {
          const slug = createSlug(product.category);
          const newCat = await prisma.category.create({
            data: { name: product.category, slug },
          });
          categoryId = newCat.id;
          categoryMap.set(product.category.toLocaleLowerCase('uk'), newCat.id);
        }
      }

      const existingProduct = await prisma.product.findUnique({
        where: { code: data.code },
      });

      if (existingProduct) {
        // Ensure slug uniqueness when name changes
        let slug = data.slug;
        if (existingProduct.name !== data.name) {
          const slugExists = await prisma.product.findFirst({
            where: { slug, id: { not: existingProduct.id } },
          });
          if (slugExists) slug = `${slug}-${data.code.toLowerCase()}`;
        } else {
          slug = existingProduct.slug;
        }

        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name: data.name,
            slug,
            priceRetail: data.priceRetail,
            priceWholesale: data.priceWholesale,
            quantity: data.quantity,
            isActive: data.isActive,
            // Only overwrite physical params/cost when 1C explicitly sends a
            // value — otherwise we'd null-out fields edited in the admin UI.
            ...(data.weightGrams !== null ? { weightGrams: data.weightGrams } : {}),
            ...(data.lengthMm !== null ? { lengthMm: data.lengthMm } : {}),
            ...(data.widthMm !== null ? { widthMm: data.widthMm } : {}),
            ...(data.heightMm !== null ? { heightMm: data.heightMm } : {}),
            ...(data.cost !== null ? { cost: data.cost } : {}),
            ...(categoryId !== null ? { categoryId } : {}),
          },
        });
        result.updated++;
      } else {
        // Ensure slug uniqueness for new product
        let slug = data.slug;
        const slugExists = await prisma.product.findUnique({ where: { slug } });
        if (slugExists) slug = `${slug}-${data.code.toLowerCase()}`;

        await prisma.product.create({
          data: {
            code: data.code,
            name: data.name,
            slug,
            priceRetail: data.priceRetail,
            priceWholesale: data.priceWholesale,
            quantity: data.quantity,
            isActive: data.isActive,
            weightGrams: data.weightGrams,
            lengthMm: data.lengthMm,
            widthMm: data.widthMm,
            heightMm: data.heightMm,
            cost: data.cost,
            categoryId,
          },
        });
        result.created++;
      }

      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        code: product.code,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  await cacheInvalidate('products:*');
  await cacheInvalidate('categories:*');

  return result;
}

/** Export orders to 1C format */
export async function exportOrdersTo1C(filters?: {
  status?: string;
  from?: Date;
  to?: Date;
}): Promise<OneCOrder[]> {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.from || filters?.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { fullName: true, phone: true, email: true } },
      items: {
        include: {
          product: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return orders.map(transformOrderTo1C);
}

/** Update stock from 1C */
export async function updateStockFrom1C(stockData: OneCStockItem[]): Promise<SyncResult> {
  const result: SyncResult = {
    total: stockData.length,
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const item of stockData) {
    try {
      const product = await prisma.product.findUnique({
        where: { code: item.code },
      });

      if (!product) {
        result.failed++;
        result.errors.push({
          code: item.code,
          message: `Product not found: ${item.code}`,
        });
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: { quantity: item.quantity },
      });

      result.updated++;
      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        code: item.code,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  await cacheInvalidate('products:*');

  return result;
}

/** Update prices from 1C */
export async function updatePricesFrom1C(priceData: OneCPriceItem[]): Promise<SyncResult> {
  const result: SyncResult = {
    total: priceData.length,
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const item of priceData) {
    try {
      const product = await prisma.product.findUnique({
        where: { code: item.code },
      });

      if (!product) {
        result.failed++;
        result.errors.push({
          code: item.code,
          message: `Product not found: ${item.code}`,
        });
        continue;
      }

      const updateData: Record<string, unknown> = {};
      if (item.priceRetail !== undefined) updateData.priceRetail = item.priceRetail;
      if (item.priceWholesale !== undefined) updateData.priceWholesale = item.priceWholesale;
      if (item.priceWholesale2 !== undefined) updateData.priceWholesale2 = item.priceWholesale2;
      if (item.priceWholesale3 !== undefined) updateData.priceWholesale3 = item.priceWholesale3;

      if (Object.keys(updateData).length > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: updateData,
        });
      }

      result.updated++;
      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        code: item.code,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  await cacheInvalidate('products:*');

  return result;
}
