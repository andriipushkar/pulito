import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';

export interface FeedItem {
  id: number;
  code: string;
  name: string;
  description: string;
  shortDescription: string;
  url: string;
  imageUrl: string | null;
  additionalImages: string[];
  price: number;
  oldPrice: number | null;
  available: boolean;
  quantity: number;
  brand: string | null;
  category: string | null;
  categoryPath: string;
  barcode: string | null;
  weightGrams: number | null;
  updatedAt: Date;
}

export interface FeedContext {
  siteUrl: string;
  siteName: string;
  siteDescription: string;
  shopEmail: string;
  items: FeedItem[];
}

const FEED_PRODUCT_LIMIT = 5000;

function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(siteUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

function buildCategoryPath(
  categoryId: number | null,
  categoryMap: Map<number, { name: string; parentId: number | null }>,
): { leaf: string | null; full: string } {
  if (!categoryId) return { leaf: null, full: '' };
  const chain: string[] = [];
  let current: number | null = categoryId;
  let safety = 10;
  while (current && safety-- > 0) {
    const node = categoryMap.get(current);
    if (!node) break;
    chain.unshift(node.name);
    current = node.parentId;
  }
  return {
    leaf: chain[chain.length - 1] ?? null,
    full: chain.join(' > '),
  };
}

export async function getFeedContext(): Promise<FeedContext> {
  const [settings, products, categories] = await Promise.all([
    getSettings(),
    prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        content: {
          select: { shortDescription: true, fullDescription: true },
        },
        images: {
          select: {
            pathFull: true,
            pathOriginal: true,
            pathMedium: true,
            isMain: true,
            sortOrder: true,
          },
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
          take: 10,
        },
        brand: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
      take: FEED_PRODUCT_LIMIT,
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  const categoryMap = new Map(
    categories.map((c) => [c.id, { name: c.name, parentId: c.parentId }]),
  );

  const siteUrl = (process.env.APP_URL || 'https://pulito.trade').replace(/\/$/, '');

  const items: FeedItem[] = products.map((p) => {
    const imagePaths = p.images
      .map((i) => i.pathFull || i.pathOriginal || i.pathMedium)
      .filter((v): v is string => Boolean(v));

    const imageUrls = imagePaths
      .map((path) => absoluteUrl(siteUrl, path))
      .filter((v): v is string => Boolean(v));

    const { leaf, full } = buildCategoryPath(p.categoryId, categoryMap);

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description:
        stripHtml(p.content?.fullDescription) || stripHtml(p.content?.shortDescription) || p.name,
      shortDescription: stripHtml(p.content?.shortDescription),
      url: `${siteUrl}/product/${p.slug}`,
      imageUrl: imageUrls[0] ?? null,
      additionalImages: imageUrls.slice(1),
      price: Number(p.priceRetail),
      oldPrice: p.priceRetailOld ? Number(p.priceRetailOld) : null,
      available: p.quantity > 0,
      quantity: p.quantity,
      brand: p.brand?.name ?? null,
      category: leaf,
      categoryPath: full,
      barcode: p.barcode,
      weightGrams: p.weightGrams,
      updatedAt: p.updatedAt,
    };
  });

  return {
    siteUrl,
    siteName: settings.site_name || 'Pulito Trade',
    siteDescription:
      settings.company_description || 'Інтернет-магазин побутової хімії та засобів для дому.',
    shopEmail: settings.site_email || '',
    items,
  };
}

export function escapeXml(input: string): string {
  return stripXmlControlChars(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** XML 1.0 disallows most C0 control chars (only \t, \n, \r are legal). A
 * product name with a stray TAB or null byte would otherwise produce
 * malformed XML that Google/Hotline parsers reject — silent feed kill. */
export function stripXmlControlChars(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** CDATA sections cannot contain the literal `]]>` — a product description
 * with that sequence prematurely closes the section and the rest leaks
 * into raw XML. Standard workaround: split into two CDATA blocks. */
export function escapeCdata(input: string): string {
  return stripXmlControlChars(input).replace(/]]>/g, ']]]]><![CDATA[>');
}

/** Shared cache TTL for product/category feeds (30 min). Was inconsistent
 * across routes (600s / 1800s / 3600s); admin help-text says 30 min. */
export const FEED_CACHE_MAX_AGE = 1800;
