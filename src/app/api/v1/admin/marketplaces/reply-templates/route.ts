import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const templates = await prisma.marketplaceReplyTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return successResponse(templates);
  } catch (err) {
    logger.error('[admin/marketplaces/reply-templates] GET failed', { error: err });
    return errorResponse('Помилка завантаження шаблонів', 500);
  }
});

export const POST = withRole('admin')(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as { name?: string; content?: string };
    if (!body.name?.trim() || !body.content?.trim()) {
      return errorResponse('name та content обов\'язкові', 400);
    }
    const created = await prisma.marketplaceReplyTemplate.create({
      data: { name: body.name.trim(), content: body.content.trim() },
    });
    return successResponse(created);
  } catch (err) {
    logger.error('[admin/marketplaces/reply-templates] POST failed', { error: err });
    return errorResponse('Помилка створення шаблону', 500);
  }
});
