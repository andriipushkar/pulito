import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  feedUrl: z.string().url().max(2000),
  format: z.enum(['xlsx', 'csv', 'yml', 'xml_1c']),
  authType: z.enum(['none', 'basic', 'bearer']).default('none'),
  authUsername: z.string().max(255).optional().nullable(),
  authPassword: z.string().max(255).optional().nullable(),
  authToken: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  scheduleCron: z.string().max(100).optional().nullable(),
});

export const GET = withRole(
  'manager',
  'admin',
)(async () => {
  try {
    const channels = await prisma.supplierChannel.findMany({
      orderBy: { id: 'desc' },
    });
    // Strip sensitive fields when listing — admin sees them in single-GET.
    const sanitized = channels.map((c) => ({
      ...c,
      authPassword: c.authPassword ? '***' : null,
      authToken: c.authToken ? '***' : null,
    }));
    return successResponse(sanitized);
  } catch (err) {
    logger.error('[admin/supplier-channels] GET failed', { error: err });
    return errorResponse('Помилка завантаження каналів', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const channel = await prisma.supplierChannel.create({ data: parsed.data });
    return successResponse(channel, 201);
  } catch (err) {
    logger.error('[admin/supplier-channels] POST failed', { error: err });
    return errorResponse('Не вдалося створити канал', 500);
  }
});
