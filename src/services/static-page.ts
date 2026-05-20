import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { sanitizeHtml } from '@/utils/sanitize';

export class StaticPageError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'StaticPageError';
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
  isPublished?: boolean;
  sortOrder?: number;
  updatedBy?: number;
}) {
  const slug = data.slug || createSlug(data.title);

  const existing = await prisma.staticPage.findUnique({ where: { slug } });
  if (existing) {
    throw new StaticPageError('Сторінка з таким slug вже існує', 409);
  }

  return prisma.staticPage.create({
    data: {
      title: data.title,
      slug,
      content: sanitizeHtml(data.content),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isPublished: data.isPublished ?? true,
      sortOrder: data.sortOrder ?? 0,
      updatedBy: data.updatedBy,
    },
  });
}

export async function updatePage(
  id: number,
  data: {
    title?: string;
    slug?: string;
    content?: string;
    seoTitle?: string;
    seoDescription?: string;
    isPublished?: boolean;
    sortOrder?: number;
    parentId?: number | null;
    updatedBy?: number;
  }
) {
  const page = await prisma.staticPage.findUnique({ where: { id } });
  if (!page) throw new StaticPageError('Сторінку не знайдено', 404);

  if (data.slug && data.slug !== page.slug) {
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

  return prisma.staticPage.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.content !== undefined && { content: sanitizeHtml(data.content) }),
      ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
      ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
    },
  });
}

export async function deletePage(id: number) {
  const page = await prisma.staticPage.findUnique({ where: { id } });
  if (!page) throw new StaticPageError('Сторінку не знайдено', 404);

  await prisma.staticPage.delete({ where: { id } });
}
