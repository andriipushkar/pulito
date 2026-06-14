import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { encrypt } from '@/lib/encryption';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { supplierChannelCreateSchema } from '@/validators/supplier-channel';

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

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = supplierChannelCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    // Encrypt credentials at rest. A DB read should not yield plaintext basic-
    // auth passwords or bearer tokens for partner feeds.
    const data = { ...parsed.data };
    if (data.authPassword) data.authPassword = encrypt(data.authPassword);
    if (data.authToken) data.authToken = encrypt(data.authToken);
    const channel = await prisma.supplierChannel.create({ data });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'supplier_channel',
      entityId: channel.id,
      details: {
        name: channel.name,
        format: channel.format,
        syncMode: channel.syncMode,
        fulfillment: channel.fulfillment,
      },
      ipAddress: getClientIp(request),
    });
    return successResponse(
      {
        ...channel,
        authPassword: channel.authPassword ? '***' : null,
        authToken: channel.authToken ? '***' : null,
      },
      201,
    );
  } catch (err) {
    logger.error('[admin/supplier-channels] POST failed', { error: err });
    return errorResponse('Не вдалося створити канал', 500);
  }
});
