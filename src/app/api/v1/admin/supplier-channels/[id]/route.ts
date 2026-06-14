import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { encrypt } from '@/lib/encryption';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { supplierChannelUpdateSchema } from '@/validators/supplier-channel';

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

export const PUT = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = supplierChannelUpdateSchema.safeParse(body);
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
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'supplier_channel',
      entityId: numId,
      details: { fields: Object.keys(data) },
      ipAddress: getClientIp(request),
    });
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

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await prisma.supplierChannel.delete({ where: { id: numId } });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'supplier_channel',
      entityId: numId,
      ipAddress: getClientIp(request),
    });
    return successResponse({ deleted: true });
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити', 500);
  }
});
