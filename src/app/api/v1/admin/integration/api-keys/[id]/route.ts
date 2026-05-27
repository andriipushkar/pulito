import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
});

export const PATCH = withRole2fa('admin')(async (request: NextRequest, { user, params }) => {
  try {
    const { id: idStr } = await (params as Promise<{ id: string }>);
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse('Невалідний id', 400);
    }
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, isActive: true },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'api_key',
      entityId: id,
      details: parsed.data,
      ipAddress: getClientIp(request),
    });

    return successResponse(updated);
  } catch (err) {
    logger.error('[admin/integration/api-keys/[id]] PATCH failed', { error: err });
    return errorResponse('Не вдалося оновити ключ', 500);
  }
});
