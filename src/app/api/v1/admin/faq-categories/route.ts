import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  iconPath: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

export const GET = withRole(
  'manager',
  'admin',
)(async () => {
  try {
    const cats = await prisma.faqCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return successResponse(cats);
  } catch (err) {
    logger.error('[admin/faq-categories] GET failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const slug = parsed.data.slug || createSlug(parsed.data.name);
    const existing = await prisma.faqCategory.findUnique({ where: { slug } });
    if (existing) return errorResponse('Категорія з таким slug вже існує', 409);
    const cat = await prisma.faqCategory.create({
      data: { ...parsed.data, slug },
    });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'faq_category',
      entityId: cat.id,
    });
    return successResponse(cat, 201);
  } catch (err) {
    logger.error('[admin/faq-categories] POST failed', { error: err });
    return errorResponse('Не вдалося створити', 500);
  }
});
