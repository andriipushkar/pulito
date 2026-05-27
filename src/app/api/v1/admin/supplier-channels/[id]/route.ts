import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { isSafeOutboundUrl } from '@/utils/safe-url';
import { encrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  feedUrl: z
    .string()
    .url()
    .max(2000)
    .refine((u) => isSafeOutboundUrl(u, { protocols: ['http:', 'https:'] }), {
      message: 'URL вказує на приватну/локальну адресу — заборонено',
    })
    .optional(),
  format: z.enum(['xlsx', 'csv', 'yml', 'xml_1c']).optional(),
  authType: z.enum(['none', 'basic', 'bearer']).optional(),
  authUsername: z.string().max(255).optional().nullable(),
  authPassword: z.string().max(255).optional().nullable(),
  authToken: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  scheduleCron: z.string().max(100).optional().nullable(),
});

export const GET = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const channel = await prisma.supplierChannel.findUnique({ where: { id: numId } });
    if (!channel) return errorResponse('Канал не знайдено', 404);
    return successResponse(channel);
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]] GET failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    // Don't overwrite secret fields if the client sent the redacted "***" mask.
    // Otherwise encrypt before persisting so DB reads never expose plaintext.
    const data = { ...parsed.data };
    if (data.authPassword === '***') delete data.authPassword;
    else if (data.authPassword) data.authPassword = encrypt(data.authPassword);
    if (data.authToken === '***') delete data.authToken;
    else if (data.authToken) data.authToken = encrypt(data.authToken);
    const channel = await prisma.supplierChannel.update({ where: { id: numId }, data });
    return successResponse({
      ...channel,
      authPassword: channel.authPassword ? '***' : null,
      authToken: channel.authToken ? '***' : null,
    });
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]] PUT failed', { error: err });
    return errorResponse('Не вдалося оновити', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await prisma.supplierChannel.delete({ where: { id: numId } });
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити', 500);
  }
});
