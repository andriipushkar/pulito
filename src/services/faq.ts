import { prisma } from '@/lib/prisma';
import { sanitizeHtml } from '@/utils/sanitize';

export class FaqError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FaqError';
  }
}

export async function getPublishedFaq() {
  // Prefer the new FaqCategory model when it has any published categories;
  // fall back to the legacy `category` string grouping for items that still
  // haven't been migrated. This keeps the storefront stable mid-migration.
  const categoryRows = await prisma.faqCategory.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      items: {
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const grouped: Record<string, Awaited<ReturnType<typeof prisma.faqItem.findMany>>> = {};

  // First pass: items linked via categoryRefId.
  for (const cat of categoryRows) {
    if (cat.items.length > 0) {
      grouped[cat.name] = cat.items;
    }
  }

  // Second pass: legacy items without categoryRefId still need to surface.
  const orphans = await prisma.faqItem.findMany({
    where: { isPublished: true, categoryRefId: null },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });
  for (const item of orphans) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  return grouped;
}

export async function getFaqCategories() {
  // Same dual-source as getPublishedFaq — categories from the new table plus
  // any legacy string categories with orphaned items.
  const refs = await prisma.faqCategory.findMany({
    where: { isPublished: true, items: { some: { isPublished: true } } },
    select: { name: true },
    orderBy: { sortOrder: 'asc' },
  });
  const orphans = await prisma.faqItem.findMany({
    where: { isPublished: true, categoryRefId: null },
    select: { category: true },
    distinct: ['category'],
  });
  const names = new Set([...refs.map((r) => r.name), ...orphans.map((o) => o.category)]);
  return Array.from(names).sort();
}

const MAX_SEARCH_QUERY_LENGTH = 200;

export async function searchFaq(query: string) {
  // Truncate + strip control chars. Long contains() patterns scan every
  // FaqItem.answer (no full-text index here yet); a 5k-char query would
  // turn the FAQ search into a DoS hot-path.

  const cleaned = query.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, MAX_SEARCH_QUERY_LENGTH);
  return prisma.faqItem.findMany({
    where: {
      isPublished: true,
      OR: [
        { question: { contains: cleaned, mode: 'insensitive' } },
        { answer: { contains: cleaned, mode: 'insensitive' } },
      ],
    },
    orderBy: { clickCount: 'desc' },
    take: 50,
  });
}

export async function incrementFaqClick(id: number) {
  await prisma.faqItem.update({
    where: { id },
    data: { clickCount: { increment: 1 } },
  });
}

export async function getAllFaq() {
  return prisma.faqItem.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function createFaqItem(data: {
  category: string;
  question: string;
  answer: string;
  questionEn?: string;
  answerEn?: string;
  sortOrder?: number;
  isPublished?: boolean;
}) {
  return prisma.faqItem.create({
    data: {
      category: data.category,
      question: data.question,
      // Answer is rendered as HTML on the storefront — sanitize at write time
      // so a stored-XSS payload can't reach the visitor's browser.
      answer: sanitizeHtml(data.answer),
      questionEn: data.questionEn || null,
      answerEn: data.answerEn ? sanitizeHtml(data.answerEn) : null,
      sortOrder: data.sortOrder ?? 0,
      isPublished: data.isPublished ?? true,
    },
  });
}

export async function updateFaqItem(
  id: number,
  data: {
    category?: string;
    question?: string;
    answer?: string;
    questionEn?: string;
    answerEn?: string;
    sortOrder?: number;
    isPublished?: boolean;
  },
) {
  const item = await prisma.faqItem.findUnique({ where: { id } });
  if (!item) throw new FaqError('Питання не знайдено', 404);

  // Build a typed update payload so EN fields convert empty → null instead of
  // being treated as an unrelated string property by the spread above.
  const { questionEn, answerEn, ...rest } = data;
  return prisma.faqItem.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.answer !== undefined && { answer: sanitizeHtml(rest.answer) }),
      ...(questionEn !== undefined && { questionEn: questionEn || null }),
      ...(answerEn !== undefined && { answerEn: answerEn ? sanitizeHtml(answerEn) : null }),
    },
  });
}

export async function deleteFaqItem(id: number) {
  const item = await prisma.faqItem.findUnique({ where: { id } });
  if (!item) throw new FaqError('Питання не знайдено', 404);

  await prisma.faqItem.delete({ where: { id } });
}
