import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const PATCH = withRole('admin')(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const tid = Number(id);
    if (Number.isNaN(tid)) return errorResponse('Невалідний ID', 400);
    const body = (await req.json()) as { name?: string; content?: string; isActive?: boolean };
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.content === 'string') data.content = body.content.trim();
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    const updated = await prisma.marketplaceReplyTemplate.update({
      where: { id: tid },
      data,
    });
    return successResponse(updated);
  } catch (err) {
    logger.error('[admin/marketplaces/reply-templates/[id]] PATCH failed', { error: err });
    return errorResponse('Помилка оновлення шаблону', 500);
  }
});

export const DELETE = withRole('admin')(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const tid = Number(id);
    if (Number.isNaN(tid)) return errorResponse('Невалідний ID', 400);
    await prisma.marketplaceReplyTemplate.delete({ where: { id: tid } });
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/marketplaces/reply-templates/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення шаблону', 500);
  }
});
