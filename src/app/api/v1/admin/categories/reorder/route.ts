import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { cacheInvalidate } from '@/services/cache';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    await prisma.$transaction(
      parsed.data.items.map((item) =>
        prisma.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    await cacheInvalidate('categories:*');
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'category',
      details: { action: 'reorder', count: parsed.data.items.length },
      ipAddress: getClientIp(request),
    });
    return successResponse({ updated: parsed.data.items.length });
  } catch (error) {
    logger.error('[admin/categories/reorder] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
