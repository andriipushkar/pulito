import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole, withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const scheduleSchema = z.object({
  enabled: z.boolean(),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  timezone: z.string().default('Europe/Kyiv'),
});

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'bot_schedule' },
    });

    const defaults = { enabled: false, startHour: 9, endHour: 18, timezone: 'Europe/Kyiv' };
    const config = setting ? JSON.parse(setting.value) : defaults;

    return successResponse(config);
  } catch (err) {
    logger.error('[admin/bot-settings/schedule] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    await prisma.siteSetting.upsert({
      where: { key: 'bot_schedule' },
      create: { key: 'bot_schedule', value: JSON.stringify(parsed.data), updatedBy: user.id },
      update: { value: JSON.stringify(parsed.data), updatedBy: user.id },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'bot_schedule',
      details: parsed.data,
    });

    return successResponse(parsed.data);
  } catch (err) {
    logger.error('[admin/bot-settings/schedule] PUT failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
