import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  iconPath: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Catch slug/name collisions before relying on the unique constraint to
    // throw a generic Prisma error — keeps the 409 message admin-friendly.
    if (parsed.data.slug || parsed.data.name) {
      const conflict = await prisma.faqCategory.findFirst({
        where: {
          id: { not: numId },
          OR: [
            ...(parsed.data.slug ? [{ slug: parsed.data.slug }] : []),
            ...(parsed.data.name ? [{ name: parsed.data.name }] : []),
          ],
        },
        select: { id: true },
      });
      if (conflict) return errorResponse('Категорія з таким slug/назвою вже існує', 409);
    }

    const cat = await prisma.faqCategory.update({
      where: { id: numId },
      data: parsed.data,
    });
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'faq_category',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
    });
    return successResponse(cat);
  } catch (err) {
    logger.error('[admin/faq-categories/[id]] PUT failed', { error: err });
    return errorResponse('Не вдалося оновити', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    // Detach items first — schema allows FaqItem.categoryRefId to be null.
    await prisma.faqItem.updateMany({
      where: { categoryRefId: numId },
      data: { categoryRefId: null },
    });
    await prisma.faqCategory.delete({ where: { id: numId } });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'faq_category',
      entityId: numId,
    });
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/faq-categories/[id]] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити', 500);
  }
});
