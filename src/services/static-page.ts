import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { sanitizeHtml } from '@/utils/sanitize';

export class StaticPageError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'StaticPageError';
  }
}

// Postgres unique-violation (P2002). The findUnique slug pre-checks below
// narrow the common case, but two concurrent create/update calls can both pass
// the read and race to the unique index — the DB is the only authority that
// serialises them, so surface a clean 409 instead of a raw 500.
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
  );
}

// Routes that a CMS page must never collide with. The public router serves
// pages under `/<slug>`, so any of these would shadow real app namespaces
// (admin panel, API, auth, catalog, etc.). Keep the list narrow — admin can
// still create deep slugs ("about/team") freely.
const RESERVED_SLUG_PREFIXES = [
  'admin',
  'api',
  'auth',
  'account',
  'cart',
  'checkout',
  'comparison',
  'wishlist',
  'order',
  'product',
  'catalog',
  'brand',
  'bundles',
  'blog',
  'news',
  'pages',
  'contacts',
  'faq',
  'loyalty',
  'sitemap',
  'robots.txt',
  'manifest.webmanifest',
  'opengraph-image',
  'twitter-image',
  'r',
  'uploads',
  'foto',
];

function assertSlugNotReserved(slug: string): void {
  const head = slug.split('/')[0]?.toLowerCase() ?? '';
  if (RESERVED_SLUG_PREFIXES.includes(head)) {
    throw new StaticPageError(
      `Slug "${slug}" перекриває внутрішній маршрут "${head}". Виберіть інший slug.`,
      400,
    );
  }
}

export async function getPublishedPages() {
  return prisma.staticPage.findMany({
    where: { isPublished: true },
    select: { id: true, slug: true, title: true, sortOrder: true, updatedAt: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getPageBySlug(slug: string) {
  return prisma.staticPage.findUnique({
    where: { slug, isPublished: true },
    include: {
      parent: { select: { id: true, title: true, slug: true } },
      children: {
        where: { isPublished: true },
        select: { id: true, title: true, slug: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      },
    },
  });
}

export async function getAllPages() {
  return prisma.staticPage.findMany({
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createPage(data: {
  title: string;
  slug?: string;
  content: string;
  seoTitle?: string;
  seoDescription?: string;
  titleEn?: string;
  contentEn?: string;
  seoTitleEn?: string;
  seoDescriptionEn?: string;
  isPublished?: boolean;
  sortOrder?: number;
  updatedBy?: number;
}) {
  const slug = data.slug || createSlug(data.title);

  // Reserved routes — never let a CMS page shadow them. Pages live under
  // `/<slug>` on the public site, so a slug like "admin" would intercept
  // requests heading for `/admin` (the panel itself) and a `/api` page
  // would shadow the API namespace from the catch-all. Block at create
  // time so the operator never has to debug "why is my checkout broken".
  assertSlugNotReserved(slug);

  const existing = await prisma.staticPage.findUnique({ where: { slug } });
  if (existing) {
    throw new StaticPageError('Сторінка з таким slug вже існує', 409);
  }

  try {
    return await prisma.staticPage.create({
      data: {
        title: data.title,
        slug,
        content: sanitizeHtml(data.content),
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        titleEn: data.titleEn || null,
        contentEn: data.contentEn ? sanitizeHtml(data.contentEn) : null,
        seoTitleEn: data.seoTitleEn || null,
        seoDescriptionEn: data.seoDescriptionEn || null,
        isPublished: data.isPublished ?? true,
        sortOrder: data.sortOrder ?? 0,
        updatedBy: data.updatedBy,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new StaticPageError('Сторінка з таким slug вже існує', 409);
    }
    throw e;
  }
}

export async function updatePage(
  id: number,
  data: {
    title?: string;
    slug?: string;
    content?: string;
    seoTitle?: string;
    seoDescription?: string;
    titleEn?: string;
    contentEn?: string;
    seoTitleEn?: string;
    seoDescriptionEn?: string;
    isPublished?: boolean;
    sortOrder?: number;
    parentId?: number | null;
    updatedBy?: number;
  },
) {
  const page = await prisma.staticPage.findUnique({ where: { id } });
  if (!page) throw new StaticPageError('Сторінку не знайдено', 404);

  if (data.slug && data.slug !== page.slug) {
    assertSlugNotReserved(data.slug);
    const existing = await prisma.staticPage.findUnique({ where: { slug: data.slug } });
    if (existing) throw new StaticPageError('Сторінка з таким slug вже існує', 409);
  }

  // Hierarchy rules: max one level deep (so a child can't itself become a
  // parent), and the parent must exist + not be itself.
  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      throw new StaticPageError('Сторінка не може бути своїм батьком', 400);
    }
    const parent = await prisma.staticPage.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new StaticPageError('Батьківську сторінку не знайдено', 404);
    if (parent.parentId !== null) {
      throw new StaticPageError('Підтримується лише один рівень вкладеності', 400);
    }
    // Same depth-limit on the way down: if this page already has children,
    // it cannot itself become a child.
    const hasChildren = await prisma.staticPage.count({ where: { parentId: id } });
    if (hasChildren > 0) {
      throw new StaticPageError(
        'Не можна зробити підсторінкою — у цієї сторінки вже є дочірні',
        400,
      );
    }
  }

  try {
    return await prisma.staticPage.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.content !== undefined && { content: sanitizeHtml(data.content) }),
        ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
        ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn || null }),
        ...(data.contentEn !== undefined && {
          contentEn: data.contentEn ? sanitizeHtml(data.contentEn) : null,
        }),
        ...(data.seoTitleEn !== undefined && { seoTitleEn: data.seoTitleEn || null }),
        ...(data.seoDescriptionEn !== undefined && {
          seoDescriptionEn: data.seoDescriptionEn || null,
        }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new StaticPageError('Сторінка з таким slug вже існує', 409);
    }
    throw e;
  }
}

export async function deletePage(id: number) {
  const page = await prisma.staticPage.findUnique({ where: { id } });
  if (!page) throw new StaticPageError('Сторінку не знайдено', 404);

  await prisma.staticPage.delete({ where: { id } });
}
