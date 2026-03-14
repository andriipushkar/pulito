import Typesense from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';

const client = new Typesense.Client({
  nodes: [{
    host: env.TYPESENSE_HOST,
    port: env.TYPESENSE_PORT,
    protocol: env.TYPESENSE_PROTOCOL,
  }],
  apiKey: env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
});

const COLLECTION_NAME = 'products';

const productSchema: CollectionCreateSchema = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'name', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'slug', type: 'string' },
    { name: 'categoryName', type: 'string', optional: true },
    { name: 'categorySlug', type: 'string', optional: true },
    { name: 'priceRetail', type: 'float' },
    { name: 'quantity', type: 'int32' },
    { name: 'isActive', type: 'bool' },
    { name: 'isPromo', type: 'bool' },
    { name: 'ordersCount', type: 'int32' },
    { name: 'imagePath', type: 'string', optional: true },
  ],
  default_sorting_field: 'ordersCount',
};

/**
 * Ensure the products collection exists in Typesense.
 */
export async function ensureCollection(): Promise<void> {
  try {
    await client.collections(COLLECTION_NAME).retrieve();
  } catch {
    await client.collections().create(productSchema);
  }
}

/**
 * Index all active products from DB into Typesense.
 */
export async function indexAllProducts(): Promise<{ indexed: number }> {
  await ensureCollection();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      priceRetail: true,
      quantity: true,
      isActive: true,
      isPromo: true,
      ordersCount: true,
      imagePath: true,
      category: { select: { name: true, slug: true } },
    },
  });

  const documents = products.map((p) => ({
    id: String(p.id),
    name: p.name,
    code: p.code,
    slug: p.slug,
    categoryName: p.category?.name || '',
    categorySlug: p.category?.slug || '',
    priceRetail: Number(p.priceRetail),
    quantity: p.quantity,
    isActive: p.isActive,
    isPromo: p.isPromo,
    ordersCount: p.ordersCount,
    imagePath: p.imagePath || '',
  }));

  // Upsert in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    await client.collections(COLLECTION_NAME).documents().import(batch, { action: 'upsert' });
  }

  return { indexed: documents.length };
}

/**
 * Index a single product (after create/update).
 */
export async function indexProduct(productId: number): Promise<void> {
  try {
    await ensureCollection();

    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        priceRetail: true,
        quantity: true,
        isActive: true,
        isPromo: true,
        ordersCount: true,
        imagePath: true,
        category: { select: { name: true, slug: true } },
      },
    });

    if (!p) return;

    if (!p.isActive) {
      // Remove from index if deactivated
      try { await client.collections(COLLECTION_NAME).documents(String(p.id)).delete(); } catch { /* ignore */ }
      return;
    }

    await client.collections(COLLECTION_NAME).documents().upsert({
      id: String(p.id),
      name: p.name,
      code: p.code,
      slug: p.slug,
      categoryName: p.category?.name || '',
      categorySlug: p.category?.slug || '',
      priceRetail: Number(p.priceRetail),
      quantity: p.quantity,
      isActive: p.isActive,
      isPromo: p.isPromo,
      ordersCount: p.ordersCount,
      imagePath: p.imagePath || '',
    });
  } catch (err) {
    console.error(`Typesense index error for product ${productId}:`, err);
  }
}

/**
 * Search products via Typesense with typo tolerance & instant results.
 */
export async function searchProducts(query: string, options?: {
  page?: number;
  limit?: number;
  filterBy?: string;
  sortBy?: string;
}) {
  try {
    await ensureCollection();

    const result = await client.collections(COLLECTION_NAME).documents().search({
      q: query,
      query_by: 'name,code,categoryName',
      filter_by: options?.filterBy || 'isActive:true',
      sort_by: options?.sortBy || '_text_match:desc,ordersCount:desc',
      page: options?.page || 1,
      per_page: options?.limit || 20,
      typo_tokens_threshold: 3,
      num_typos: 2,
      highlight_full_fields: 'name',
    });

    return {
      hits: (result.hits || []).map((hit) => ({
        ...(hit.document as Record<string, unknown>),
        id: Number((hit.document as { id: string }).id),
        highlight: hit.highlights,
      })),
      total: result.found,
      page: result.page,
    };
  } catch (err) {
    console.error('Typesense search error:', err);
    return null; // Fallback to DB search
  }
}

/**
 * Autocomplete (instant search with prefix matching).
 */
export async function autocomplete(query: string, limit = 8) {
  try {
    await ensureCollection();

    const result = await client.collections(COLLECTION_NAME).documents().search({
      q: query,
      query_by: 'name,code',
      filter_by: 'isActive:true',
      per_page: limit,
      prefix: 'true,true',
      typo_tokens_threshold: 2,
      num_typos: 1,
    });

    return (result.hits || []).map((hit) => {
      const doc = hit.document as Record<string, unknown>;
      return {
        id: Number(doc.id),
        name: doc.name as string,
        code: doc.code as string,
        slug: doc.slug as string,
        priceRetail: doc.priceRetail as number,
        imagePath: (doc.imagePath as string) || null,
        categoryName: (doc.categoryName as string) || null,
      };
    });
  } catch {
    return null; // Fallback to DB search
  }
}

/**
 * Check if Typesense is available.
 */
export async function isTypesenseAvailable(): Promise<boolean> {
  try {
    await client.health.retrieve();
    return true;
  } catch {
    return false;
  }
}
