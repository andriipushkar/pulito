import Typesense from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const client = new Typesense.Client({
  nodes: [
    {
      host: env.TYPESENSE_HOST,
      port: env.TYPESENSE_PORT,
      protocol: env.TYPESENSE_PROTOCOL,
    },
  ],
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
    { name: 'brandName', type: 'string', optional: true },
    { name: 'brandSlug', type: 'string', optional: true },
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
 * Ensure the products collection exists in Typesense AND has all the fields
 * we currently care about. If we add a new field to `productSchema`,
 * existing deployments need it added to the live collection — otherwise
 * upserts fail with "field not in schema". We use Typesense's
 * update-fields API to add any missing optional fields in place.
 */
export async function ensureCollection(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: any;
  try {
    existing = await client.collections(COLLECTION_NAME).retrieve();
  } catch {
    await client.collections().create(productSchema);
    return;
  }

  const existingNames = new Set<string>(
    (existing?.fields ?? []).map((f: { name: string }) => f.name),
  );
  const missing = productSchema.fields.filter((f) => !existingNames.has(f.name));
  if (missing.length === 0) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.collections(COLLECTION_NAME) as any).update({ fields: missing });
    logger.info('Typesense collection updated', { added: missing.map((f) => f.name) });
  } catch (err) {
    logger.error('Typesense collection update failed', { error: String(err) });
  }
}

/**
 * Configure search synonyms for typo tolerance and Ukrainian language variants.
 */
export async function configureSynonyms(): Promise<void> {
  await ensureCollection();

  const synonyms = [
    {
      id: 'poroshok',
      synonyms: ['порошок', 'прашок', 'парашок', 'пральний засіб', 'засіб для прання'],
    },
    { id: 'gel', synonyms: ['гель', 'гел', 'рідкий засіб', 'рідина'] },
    { id: 'kapsuly', synonyms: ['капсули', 'капсулы', 'подушечки', 'таблетки для прання'] },
    { id: 'konditsioner', synonyms: ['кондиціонер', 'ополіскувач', "пом'якшувач"] },
    { id: 'plyamovyvidnyk', synonyms: ['плямовивідник', 'відбілювач', 'пятновыводитель'] },
    { id: 'mylo', synonyms: ['мило', 'мыло', 'мильний засіб'] },
    { id: 'shampun', synonyms: ['шампунь', 'шампун', 'шампуні'] },
    { id: 'zubna', synonyms: ['зубна паста', 'зубна', 'паста для зубів'] },
    {
      id: 'posud',
      synonyms: ['посуд', 'посуда', 'миття посуду', 'плин для посуду', 'засіб для посуду'],
    },
    { id: 'chyshennya', synonyms: ['чищення', 'чистка', 'миючий засіб', 'засіб для чищення'] },
    { id: 'fairy', synonyms: ['fairy', 'фейрі', 'фери'] },
    { id: 'persil', synonyms: ['persil', 'персіл', 'персил'] },
    { id: 'ariel', synonyms: ['ariel', 'аріель', 'аріел'] },
    { id: 'tide', synonyms: ['tide', 'тайд', 'тайт'] },
  ];

  for (const syn of synonyms) {
    try {
      await client.collections(COLLECTION_NAME).synonyms().upsert(syn.id, {
        synonyms: syn.synonyms,
      });
    } catch {
      // Synonym may already exist
    }
  }
}

/**
 * Index all active products from DB into Typesense.
 */
export async function indexAllProducts(): Promise<{ indexed: number }> {
  await ensureCollection();
  await configureSynonyms();

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
      brand: { select: { name: true, slug: true } },
    },
  });

  const documents = products.map((p) => ({
    id: String(p.id),
    name: p.name,
    code: p.code,
    slug: p.slug,
    categoryName: p.category?.name || '',
    categorySlug: p.category?.slug || '',
    brandName: p.brand?.name || '',
    brandSlug: p.brand?.slug || '',
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
        brand: { select: { name: true, slug: true } },
      },
    });

    if (!p) return;

    if (!p.isActive) {
      // Remove from index if deactivated
      try {
        await client.collections(COLLECTION_NAME).documents(String(p.id)).delete();
      } catch {
        /* ignore */
      }
      return;
    }

    await client
      .collections(COLLECTION_NAME)
      .documents()
      .upsert({
        id: String(p.id),
        name: p.name,
        code: p.code,
        slug: p.slug,
        categoryName: p.category?.name || '',
        categorySlug: p.category?.slug || '',
        brandName: p.brand?.name || '',
        brandSlug: p.brand?.slug || '',
        priceRetail: Number(p.priceRetail),
        quantity: p.quantity,
        isActive: p.isActive,
        isPromo: p.isPromo,
        ordersCount: p.ordersCount,
        imagePath: p.imagePath || '',
      });
  } catch (err) {
    logger.error('Typesense index error', { productId, error: String(err) });
  }
}

export async function removeProductFromIndex(productId: number): Promise<void> {
  try {
    await client.collections(COLLECTION_NAME).documents(String(productId)).delete();
  } catch {
    // Document may not exist; nothing to do.
  }
}

/**
 * Search products via Typesense with typo tolerance & instant results.
 */
export async function searchProducts(
  query: string,
  options?: {
    page?: number;
    limit?: number;
    filterBy?: string;
    sortBy?: string;
  },
) {
  try {
    await ensureCollection();

    const result = await client
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: query,
        query_by: 'name,code,brandName,categoryName',
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
    logger.error('Typesense search error', { error: String(err) });
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
      query_by: 'name,code,brandName',
      filter_by: 'isActive:true',
      per_page: limit,
      prefix: 'true,true,true',
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
