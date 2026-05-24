import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { z } from 'zod';
import { updateFaqItem, deleteFaqItem, FaqError } from '@/services/faq';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const updateSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  question: z.string().min(5).max(500).optional(),
  // Cap answer length so an admin can't paste a runaway essay; matches the
  // storefront FAQ block which truncates around this size.
  answer: z.string().min(5).max(20_000).optional(),
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

    const item = await updateFaqItem(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'faq_item',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
    });
    // FAQ snippets appear on the storefront home + /faq page.
    revalidatePath('/faq');
    revalidatePath('/');
    return successResponse(item);
  } catch (error) {
    if (error instanceof FaqError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/faq/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await deleteFaqItem(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'faq_item',
      entityId: numId,
    });
    revalidatePath('/faq');
    revalidatePath('/');
    return successResponse({ message: 'Питання видалено' });
  } catch (error) {
    if (error instanceof FaqError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/faq/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
